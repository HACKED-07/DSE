import express from "express";
import axios from "axios";
import { z } from "zod";
import crypto from "crypto";

const app = express();
app.use(express.json());
const PORT = 3002;

type Markets = "BTC/USDT" | "ETH/USDT" | "DOGE/USDT" | "DIDE/USDT";

type Order = {
  userId: number;
  price: number;
  originalQty: number;
  remainingQty: number;
  orderType: "BUY" | "SELL";
  market: Markets;
};

type OrderBook = Map<Markets, Map<"buys" | "sells", Order[]>>;

const ORDERBOOK: OrderBook = new Map();
ORDERBOOK.set("BTC/USDT", new Map());
ORDERBOOK.get("BTC/USDT")!.set("buys", []);
ORDERBOOK.get("BTC/USDT")!.set("sells", []);

ORDERBOOK.set("DIDE/USDT", new Map());
ORDERBOOK.get("DIDE/USDT")!.set("buys", []);
ORDERBOOK.get("DIDE/USDT")!.set("sells", []);

ORDERBOOK.set("DOGE/USDT", new Map());
ORDERBOOK.get("DOGE/USDT")!.set("buys", []);
ORDERBOOK.get("DOGE/USDT")!.set("sells", []);

ORDERBOOK.set("ETH/USDT", new Map());
ORDERBOOK.get("ETH/USDT")!.set("buys", []);
ORDERBOOK.get("ETH/USDT")!.set("sells", []);
app.post("/order", async (req, res) => {
  const body = req.body;
  const orderId = crypto.randomUUID();
  const OrderSchema = z.object({
    userId: z.number(),
    price: z.number(),
    qty: z.number(),
    orderType: z.enum(["BUY", "SELL"]),
    market: z.string(),
  });
  const safeOrder = OrderSchema.safeParse(body);
  if (!safeOrder.success) {
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
  const data = await axios.post("http://localhost:3001/wallet/lock", lockBody);
  console.log(data);
  const buyBTCOrders = ORDERBOOK.get("BTC/USDT")!.get("buys");
  const sellBTCOrders = ORDERBOOK.get("BTC/USDT")!.get("sells");

  const sortBuyBTCOrders = buyBTCOrders?.sort((a, b) => b.price - a.price);
  const sortSellBTCOrders = sellBTCOrders?.sort((a, b) => a.price - b.price);
});

app.listen(PORT, () => {
  console.log(`The server is running on http://localhost:${PORT}`);
});
