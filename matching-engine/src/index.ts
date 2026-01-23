import express from "express";
import axios from "axios";
import { z } from "zod";
import crypto from "crypto";

const app = express();
app.use(express.json());
const PORT = 3002;

type LockResponse = {
  success: string;
  lockRef: string;
};

// assigning names so that i can split to get the asset name
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
};

type OrderBook = Map<Markets, Map<"buys" | "sells", Order[]>>;

const ORDERBOOK: OrderBook = new Map();
ORDERBOOK.set(Markets["BTC/USDT"], new Map());
ORDERBOOK.get(Markets["BTC/USDT"])!.set("buys", []);
ORDERBOOK.get(Markets["BTC/USDT"])!.set("sells", []);

ORDERBOOK.set(Markets["DIDE/USDT"], new Map());
ORDERBOOK.get(Markets["DIDE/USDT"])!.set("buys", []);
ORDERBOOK.get(Markets["DIDE/USDT"])!.set("sells", []);

ORDERBOOK.set(Markets["DOGE/USDT"], new Map());
ORDERBOOK.get(Markets["DOGE/USDT"])!.set("buys", []);
ORDERBOOK.get(Markets["DOGE/USDT"])!.set("sells", []);

ORDERBOOK.set(Markets["ETH/USDT"], new Map());
ORDERBOOK.get(Markets["ETH/USDT"])!.set("buys", []);
ORDERBOOK.get(Markets["ETH/USDT"])!.set("sells", []);
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
    console.log("zod error:", safeOrder.error);
    return res.status(400).json({
      err: "Invalid body",
    });
  }

  // Lock before adding order to order book
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
  const lock = await axios.post("http://localhost:3001/wallet/lock", lockBody);
  if (!lock) {
    return res.status(400).json({
      err: "error communicating with wallet service",
    });
  }
  const lockData = lock.data as LockResponse;
  // push the new order to the order book
  if (safeOrder.data.orderType === "BUY") {
    ORDERBOOK.get(safeOrder.data.market)!.get("buys")!.push({
      orderId: lockData.lockRef,
      userId: safeOrder.data.userId,
      price: safeOrder.data.price,
      originalQty: safeOrder.data.qty,
      remainingQty: safeOrder.data.qty,
      orderType: "BUY",
      market: safeOrder.data.market,
    });
  } else {
    ORDERBOOK.get(safeOrder.data.market)!.get("sells")!.push({
      orderId: lockData.lockRef,
      userId: safeOrder.data.userId,
      price: safeOrder.data.price,
      originalQty: safeOrder.data.qty,
      remainingQty: safeOrder.data.qty,
      orderType: "SELL",
      market: safeOrder.data.market,
    });
  }
  while (true) {
    const buys = ORDERBOOK.get(safeOrder.data.market)!
      .get("buys")!
      .sort((a, b) => b.price - a.price);

    const sells = ORDERBOOK.get(safeOrder.data.market)!
      .get("sells")!
      .sort((a, b) => a.price - b.price);

    if (!buys.length || !sells.length) break;
    if (buys[0].price < sells[0].price) break;

    const buy = buys[0];
    const sell = sells[0];

    const tradeQty = Math.min(buy.remainingQty, sell.remainingQty);
    const tradePrice = sell.price;

    try {
      await axios.post("http://localhost:3001/wallet/settle", {
        buyer: {
          id: buy.userId,
          amount: tradePrice * tradeQty,
          asset: buy.market.split("/")[1],
          ref: buy.orderId,
        },
        seller: {
          id: sell.userId,
          amount: tradeQty,
          asset: sell.market.split("/")[0],
          ref: sell.orderId,
        },
        ref: "trade_" + crypto.randomUUID(),
      });
    } catch (e) {
      console.error("settle failed: ", e);
      break;
    }

    buy.remainingQty -= tradeQty;
    sell.remainingQty -= tradeQty;

    if (buy.remainingQty === 0)
      ORDERBOOK.get(safeOrder.data.market)!.get("buys")!.shift();
    if (sell.remainingQty === 0)
      ORDERBOOK.get(safeOrder.data.market)!.get("sells")!.shift();
  }

  console.log(ORDERBOOK.get(safeOrder.data.market));
  return res.json({
    success: "Succesfully order placed",
  });
});

app.post("/cancel", async (req, res) => {
  const body = req.body;
  const CancelSchema = z.object({
    orderId: z.string(),
    userId: z.number(),
    market: z.enum(Markets),
  });
  const safeBody = CancelSchema.safeParse(body);
  if (!safeBody.success) {
    return res.json({
      err: "Invalid body",
    });
  }
  interface CancelType {
    success?: string;
    err?: string;
  }
  const book = ORDERBOOK.get(safeBody.data.market);
  const order =
    book!
      .get("buys")!
      .find((order) => order.orderId === safeBody.data.orderId) ??
    book!
      .get("sells")
      ?.find((order) => order.orderId === safeBody.data.orderId);

  if (!order) {
    return res.status(400).json({
      err: "No order found!",
    });
  }
  if (order.originalQty !== order.remainingQty) {
    return res.status(400).json({
      err: "Order already partially filled!",
    });
  }
  try {
    const data = await axios.post("http://localhost:3001/wallet/release", {
      userId: safeBody.data.userId,
      orderId: safeBody.data.orderId,
    });
    const releasedData = data.data as unknown as CancelType;
    if (releasedData.success) {
      ORDERBOOK.get(safeBody.data.market)?.set(
        "buys",
        ORDERBOOK.get(safeBody.data.market)!
          .get("buys")!
          .filter((o) => o.orderId !== safeBody.data.orderId)
      );
      ORDERBOOK.get(safeBody.data.market)?.set(
        "sells",
        ORDERBOOK.get(safeBody.data.market)!
          .get("sells")!
          .filter((o) => o.orderId !== safeBody.data.orderId)
      );
      return res.json({
        success: "Successfully canceled order",
      });
    } else {
      return res.status(400).json({
        err: "Couldn't cancel the order",
      });
    }
  } catch (e) {
    return res.status(400).json({
      err: "Wallet refused release",
    });
  }
});

app.listen(PORT, () => {
  console.log(`The server is running on http://localhost:${PORT}`);
});
