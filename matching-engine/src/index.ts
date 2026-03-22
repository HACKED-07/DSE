import express from "express";
import axios from "axios";
import { z } from "zod";
import crypto from "crypto";
import cors from "cors";
import { producer } from "./producer";
import { Server } from "socket.io";
import http from "http";

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

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

const SUPPORTED_MARKETS: Markets[] = [
  Markets["BTC/USDT"],
  Markets["ETH/USDT"],
  Markets["DOGE/USDT"],
  Markets["DIDE/USDT"],
];

type Order = {
  orderId: string;
  userId: string;
  price: number;
  originalQty: number;
  remainingQty: number;
  orderType: "BUY" | "SELL";
  market: Markets;
  timestamp: number;
};

type OrderBook = Map<Markets, Map<"buys" | "sells", Order[]>>;

const ORDERBOOK: OrderBook = new Map();

const getSideOrders = (market: Markets, side: "buys" | "sells") =>
  ORDERBOOK.get(market)?.get(side) ?? [];

const getLevelQty = (
  market: Markets,
  side: "buys" | "sells",
  price: number,
) =>
  getSideOrders(market, side)
    .filter((order) => order.price === price)
    .reduce((sum, order) => sum + order.remainingQty, 0);

const initMarket = (market: Markets) => {
  ORDERBOOK.set(market, new Map());
  ORDERBOOK.get(market)!.set("buys", []);
  ORDERBOOK.get(market)!.set("sells", []);
};

initMarket(Markets["BTC/USDT"]);
initMarket(Markets["ETH/USDT"]);
initMarket(Markets["DOGE/USDT"]);
initMarket(Markets["DIDE/USDT"]);

const doesOrderCross = (incoming: Order, resting: Order) => {
  if (incoming.orderType === "BUY") {
    return incoming.price >= resting.price;
  }

  return incoming.price <= resting.price;
};

app.post("/order", async (req, res) => {
  const body = req.body;
  const orderId = crypto.randomUUID();
  const OrderSchema = z.object({
    userId: z.string(),
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
    const oppositeSide = newOrder.orderType === "BUY" ? "sells" : "buys";
    const conflictingOwnOrder = marketBook
      .get(oppositeSide)!
      .find(
        (restingOrder) =>
          restingOrder.userId === newOrder.userId &&
          doesOrderCross(newOrder, restingOrder),
      );

    if (conflictingOwnOrder) {
      await axios.post("http://localhost:3001/wallet/release", {
        userId: newOrder.userId,
        orderId: newOrder.orderId,
      });

      return res.status(409).json({
        err: "Self-trade prevention blocked the order",
      });
    }

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

    onUpdate(
      newOrder.market,
      newOrder.orderType === "BUY" ? "buys" : "sells",
      newOrder.price,
    );

    const buys = marketBook.get("buys")!;
    const sells = marketBook.get("sells")!;

    while (buys.length > 0 && sells.length > 0) {
      const bestBuy = buys[0];
      const bestSell = sells[0];

      if (bestBuy.userId === bestSell.userId) {
        break;
      }

      if (bestBuy.price < bestSell.price) {
        break;
      }

      const tradeQty = Math.min(bestBuy.remainingQty, bestSell.remainingQty);

      const tradePrice =
        bestBuy.timestamp < bestSell.timestamp ? bestBuy.price : bestSell.price;

      try {
        const [baseAsset, quoteAsset] = bestBuy.market.split("/");
        const stringValue = JSON.stringify({
          buyer: {
            id: bestBuy.userId,
            amount: tradePrice * tradeQty,
            asset: quoteAsset,
            ref: bestBuy.orderId,
          },
          seller: {
            id: bestSell.userId,
            amount: tradeQty,
            asset: baseAsset,
            ref: bestSell.orderId,
          },
          ref: "trade_" + crypto.randomUUID(),
        });
        await producer.send({
          topic: "trade.settlement",
          messages: [
            {
              value: stringValue,
            },
          ],
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

      onUpdate(bestBuy.market, "buys", bestBuy.price);
      onUpdate(bestSell.market, "sells", bestSell.price);
    }

    return res.json({
      success: "Successfully order placed",
      orderId: newOrder.orderId,
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && "response" in e) {
      const walletError = e as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      console.error(
        "wallet service rejected order:",
        walletError.response?.status,
        walletError.response?.data ?? walletError.message,
      );
    } else {
      console.error("wallet service request failed:", e);
    }
    return res
      .status(400)
      .json({ err: "error communicating with wallet service" });
  }
});

app.post("/cancel", async (req, res) => {
  const body = req.body;
  const CancelSchema = z.object({
    orderId: z.string(),
    userId: z.string(),
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

  onUpdate(
    canceledOrder.market,
    canceledOrder.orderType === "BUY" ? "buys" : "sells",
    canceledOrder.price,
  );

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

app.get("/markets", async (_req, res) => {
  return res.json({
    markets: SUPPORTED_MARKETS.map((market) => ({
      market,
      symbol: market.replace("/", "_"),
    })),
  });
});

app.get("/snapshot/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  const market = symbol.replace("_", "/") as Markets;
  const book = ORDERBOOK.get(market);

  if (!book) {
    return res.status(400).json({ err: "No market found for the symbol" });
  }

  const buys = book.get("buys")!;
  const sells = book.get("sells")!;
  const bestBid = buys[0] ?? null;
  const bestAsk = sells[0] ?? null;
  const midPrice =
    bestBid && bestAsk ? (bestBid.price + bestAsk.price) / 2 : null;

  return res.json({
    market,
    symbol,
    bestBid,
    bestAsk,
    spread:
      bestBid && bestAsk ? Number((bestAsk.price - bestBid.price).toFixed(8)) : null,
    midPrice,
    depth: {
      buys: buys.slice(0, 20),
      sells: sells.slice(0, 20),
    },
  });
});

app.get("/ohlc/:symbol", async (req, res) => {
  const symbol = req.params.symbol;
  const market = symbol.replace("_", "/") as Markets;
  res.json({ candles: CandleStick.get(market) });
});

const getTop20Levels = (market: Markets) => {
  const buys = ORDERBOOK.get(market)?.get("buys");
  const sells = ORDERBOOK.get(market)?.get("sells");
  return { buys, sells };
};

const buffers: Map<
  Markets,
  {
    buys: Map<number, number>;
    sells: Map<number, number>;
  }
> = new Map();

const initBuffer = (market: Markets) => {
  buffers.set(market, {
    buys: new Map(),
    sells: new Map(),
  });
};

initBuffer(Markets["BTC/USDT"]);
initBuffer(Markets["ETH/USDT"]);
initBuffer(Markets["DOGE/USDT"]);
initBuffer(Markets["DIDE/USDT"]);

function onUpdate(
  market: Markets,
  side: "buys" | "sells",
  price: number,
) {
  const qty = getLevelQty(market, side, price);
  buffers.get(market)![side].set(price, qty);
}

setInterval(() => {
  for (const [market, { buys, sells }] of buffers.entries()) {
    const changes: [string, number, number][] = [];

    for (const [price, qty] of buys) {
      changes.push(["buy", price, qty]);
    }
    for (const [price, qty] of sells) {
      changes.push(["sell", price, qty]);
    }

    if (changes.length > 0) {
      io.to(market).emit("update", { changes });
    }

    buffers.set(market, {
      buys: new Map(),
      sells: new Map(),
    });
  }
}, 1000);

io.on("connection", (socket) => {
  socket.on("subscribe", (market: Markets) => {
    console.log("subscribed: ", market);
    socket.join(market);
  });
});

server.listen(PORT, async () => {
  console.log(`The server is running on http://localhost:${PORT}`);
  await producer.connect();
  console.log("Kafka Producer connected successfully");
});
