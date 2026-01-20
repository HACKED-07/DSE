import express from "express";
import axios from "axios";
import { z } from "zod";
import crypto from "crypto";

const app = express();
app.use(express.json());
const PORT = 3002;

// assigning names so that i can split to get the asset name

type LockResponse = {
  success: string;
  lockRef: string;
};
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
    ORDERBOOK.get(Markets["BTC/USDT"])!.get("buys")!.push({
      orderId: lockData.lockRef,
      userId: safeOrder.data.userId,
      price: safeOrder.data.price,
      originalQty: safeOrder.data.qty,
      remainingQty: safeOrder.data.qty,
      orderType: "BUY",
      market: safeOrder.data.market,
    });
  } else {
    ORDERBOOK.get(Markets["BTC/USDT"])!.get("sells")!.push({
      orderId: lockData.lockRef,
      userId: safeOrder.data.userId,
      price: safeOrder.data.price,
      originalQty: safeOrder.data.qty,
      remainingQty: safeOrder.data.qty,
      orderType: "SELL",
      market: safeOrder.data.market,
    });
  }
  const buyBTCOrders = ORDERBOOK.get(Markets["BTC/USDT"])!.get("buys");
  const sellBTCOrders = ORDERBOOK.get(Markets["BTC/USDT"])!.get("sells");

  if (!buyBTCOrders?.length || !sellBTCOrders?.length) {
    return res.json({
      success: "Order placed but orderbook empty",
    });
  }
  const sortBuyBTCOrders = buyBTCOrders?.sort((a, b) => b.price - a.price);
  const sortSellBTCOrders = sellBTCOrders?.sort((a, b) => a.price - b.price);

  while (
    sortBuyBTCOrders?.length &&
    sortSellBTCOrders?.length &&
    sortBuyBTCOrders![0].price >= sortSellBTCOrders![0].price
  ) {
    const tradeQty =
      sortBuyBTCOrders![0].remainingQty > sortSellBTCOrders![0].remainingQty
        ? sortSellBTCOrders![0].remainingQty
        : sortBuyBTCOrders![0].remainingQty;
    const tradePrice = sortSellBTCOrders![0].price;
    console.log(ORDERBOOK.get(Markets["BTC/USDT"]));

    await axios.post("http://localhost:3001/wallet/settle", {
      buyer: {
        id: ORDERBOOK.get(Markets["BTC/USDT"])!.get("buys")![0].userId,
        amount: tradePrice * tradeQty,
        asset: ORDERBOOK.get(Markets["BTC/USDT"])!
          .get("buys")![0]
          .market.split("/")[1],
        ref: ORDERBOOK.get(Markets["BTC/USDT"])?.get("buys")![0].orderId,
      },
      seller: {
        id: ORDERBOOK.get(Markets["BTC/USDT"])!.get("sells")![0].userId,
        amount: tradeQty,
        asset: ORDERBOOK.get(Markets["BTC/USDT"])!
          .get("sells")![0]
          .market.split("/")[0],
        ref: ORDERBOOK.get(Markets["BTC/USDT"])?.get("sells")![0].orderId,
      },
      ref: "trade_" + orderId,
    });
    if (
      sortBuyBTCOrders![0].remainingQty >= sortSellBTCOrders![0].remainingQty
    ) {
      sortBuyBTCOrders![0].remainingQty =
        sortBuyBTCOrders![0].remainingQty - sortSellBTCOrders![0].remainingQty;
    } else {
      sortSellBTCOrders![0].remainingQty =
        sortSellBTCOrders![0].remainingQty - sortBuyBTCOrders![0].remainingQty;
    }

    if (sortBuyBTCOrders![0].remainingQty === 0) {
      ORDERBOOK.get(Markets["BTC/USDT"])!.get("buys")!.shift();
    }
    if (sortSellBTCOrders![0].remainingQty === 0) {
      ORDERBOOK.get(Markets["BTC/USDT"])!.get("sells")!.shift();
    }
  }
  //   console.log(sortBuyBTCOrders, "   ", sortSellBTCOrders);
  return res.json({
    success: "Succesfully order placed",
  });
});

app.listen(PORT, () => {
  console.log(`The server is running on http://localhost:${PORT}`);
});
