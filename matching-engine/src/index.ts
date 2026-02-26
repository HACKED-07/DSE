import express from "express";
import axios from "axios";
import { z } from "zod";
import crypto from "crypto";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());
const PORT = 3002;

type LockResponse = {
  success: string;
  lockRef: string;
};

type CandleStickType = {
  bucket: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const CandleStick: Map<Markets, CandleStickType[]> = new Map();

enum Markets {
  "BTC/USDT" = "BTC/USDT",
  "ETH/USDT" = "ETH/USDT",
  "DOGE/USDT" = "DOGE/USDT",
  "DIDE/USDT" = "DIDE/USDT",
}

type Order = {
  orderId: string;
  userId: number;
  price: number;
  originalQty: number;
  remainingQty: number;
  orderType: "BUY" | "SELL";
  market: Markets;
  timestamp: number;
};

type OrderBook = Map<Markets, Map<"buys" | "sells", Order[]>>;

const ORDERBOOK: OrderBook = new Map();

const initMarket = (market: Markets) => {
  ORDERBOOK.set(market, new Map());
  ORDERBOOK.get(market)!.set("buys", []);
  ORDERBOOK.get(market)!.set("sells", []);
};

initMarket(Markets["BTC/USDT"]);
initMarket(Markets["ETH/USDT"]);
initMarket(Markets["DOGE/USDT"]);
initMarket(Markets["DIDE/USDT"]);

app.post("/order", async (req, res) => {
  const body = req.body;
  const orderId = crypto.randomUUID();
  const OrderSchema = z.object({
    userId: z.number(),
    price: z.number(),
    qty: z.number(),
    orderType: z.enum(["BUY", "SELL"]),
    market: z.enum(Markets),
  });

  const safeOrder = OrderSchema.safeParse(body);
  if (!safeOrder.success) {
    return res.status(400).json({ err: "Invalid body" });
  }

  let lockBody;
  if (safeOrder.data.orderType === "BUY") {
    lockBody = {
      userId: safeOrder.data.userId,
      amount: safeOrder.data.price * safeOrder.data.qty,
      asset: safeOrder.data.market.split("/")[1],
      orderId,
    };
  } else {
    lockBody = {
      userId: safeOrder.data.userId,
      amount: safeOrder.data.qty,
      asset: safeOrder.data.market.split("/")[0],
      orderId,
    };
  }

  try {
    const lock = await axios.post(
      "http://localhost:3001/wallet/lock",
      lockBody,
    );
    const lockData = lock.data as LockResponse;

    const newOrder: Order = {
      orderId: lockData.lockRef,
      userId: safeOrder.data.userId,
      price: safeOrder.data.price,
      originalQty: safeOrder.data.qty,
      remainingQty: safeOrder.data.qty,
      orderType: safeOrder.data.orderType,
      market: safeOrder.data.market,
      timestamp: Date.now(),
    };

    const marketBook = ORDERBOOK.get(safeOrder.data.market)!;

    if (newOrder.orderType === "BUY") {
      marketBook.get("buys")!.push(newOrder);
      marketBook
        .get("buys")!
        .sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
    } else {
      marketBook.get("sells")!.push(newOrder);
      marketBook
        .get("sells")!
        .sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
    }

    const buys = marketBook.get("buys")!;
    const sells = marketBook.get("sells")!;

    while (buys.length > 0 && sells.length > 0) {
      const bestBuy = buys[0];
      const bestSell = sells[0];

      if (bestBuy.price < bestSell.price) {
        break;
      }

      const tradeQty = Math.min(bestBuy.remainingQty, bestSell.remainingQty);

      const tradePrice =
        bestBuy.timestamp < bestSell.timestamp ? bestBuy.price : bestSell.price;

      try {
        await axios.post("http://localhost:3001/wallet/settle", {
          buyer: {
            id: bestBuy.userId,
            amount: tradePrice * tradeQty,
            asset: bestBuy.market.split("/")[1],
            ref: bestBuy.orderId,
          },
          seller: {
            id: bestSell.userId,
            amount: tradeQty,
            asset: bestSell.market.split("/")[0],
            ref: bestSell.orderId,
          },
          ref: "trade_" + crypto.randomUUID(),
        });
      } catch (e) {
        console.error("settle failed: ", e);
        break;
      }

      console.log(
        `TRADE:${bestBuy.market} ${tradeQty} @ ${tradePrice} (${bestBuy.userId} buys from ${bestSell.userId})`,
      );

      if (!CandleStick.has(bestBuy.market)) CandleStick.set(bestBuy.market, []);

      const date = new Date().getTime();
      const bucket = Math.floor(date / 60000) * 60000;

      const candles = CandleStick.get(bestBuy.market)!;
      const lastCandle =
        candles.length != 0 ? candles[candles.length - 1] : null;

      if (lastCandle && lastCandle.bucket == bucket) {
        lastCandle.high = Math.max(lastCandle.high, tradePrice);
        lastCandle.low = Math.min(lastCandle.low, tradePrice);
        lastCandle.close = tradePrice;
      } else {
        candles.push({
          bucket,
          open: tradePrice,
          high: tradePrice,
          low: tradePrice,
          close: tradePrice,
        });
      }

      bestBuy.remainingQty -= tradeQty;
      bestSell.remainingQty -= tradeQty;

      if (bestBuy.remainingQty === 0) buys.shift();
      if (bestSell.remainingQty === 0) sells.shift();
    }

    return res.json({ success: "Successfully order placed" });
  } catch (e) {
    return res
      .status(400)
      .json({ err: "error communicating with wallet service" });
  }
});

app.post("/cancel", async (req, res) => {
  const body = req.body;
  const CancelSchema = z.object({
    orderId: z.string(),
    userId: z.number(),
    market: z.enum(Markets),
  });

  const safeBody = CancelSchema.safeParse(body);
  if (!safeBody.success) return res.json({ err: "Invalid body" });

  const book = ORDERBOOK.get(safeBody.data.market);
  if (!book) return res.status(400).json({ err: "Market not found" });

  const removeFromSide = (side: "buys" | "sells") => {
    const list = book.get(side)!;
    const index = list.findIndex((o) => o.orderId === safeBody.data.orderId);
    if (index > -1) {
      const order = list[index];
      if (order.userId !== safeBody.data.userId) return null;
      if (order.originalQty !== order.remainingQty) return null;
      list.splice(index, 1);
      return order;
    }
    return null;
  };

  const canceledOrder = removeFromSide("buys") || removeFromSide("sells");

  if (!canceledOrder) {
    return res.status(400).json({ err: "Order not found or already filled" });
  }

  try {
    await axios.post("http://localhost:3001/wallet/release", {
      userId: safeBody.data.userId,
      orderId: safeBody.data.orderId,
    });
    return res.json({ success: "Successfully canceled order" });
  } catch (e) {
    return res.status(400).json({ err: "Wallet refused release" });
  }
});

app.get("/markets/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  const market = symbol.replace("_", "/") as Markets;

  if (!ORDERBOOK.get(market)) {
    return res.status(400).json({ err: "No market found for the symbol" });
  }

  const smallOrderBook = ORDERBOOK.get(market)!;

  const buys = smallOrderBook.get("buys")!.slice(0, 20);
  const sells = smallOrderBook.get("sells")!.slice(0, 20);

  return res.json({ buys, sells });
});

app.get("/ohlc/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  const market = symbol.replace("_", "/") as Markets;
  res.json({ candles: CandleStick.get(market) });
});

app.listen(PORT, () => {
  console.log(`The server is running on http://localhost:${PORT}`);
});
