"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
const PORT = 3002;
var Markets;
(function (Markets) {
    Markets["BTC/USDT"] = "BTC/USDT";
    Markets["ETH/USDT"] = "ETH/USDT";
    Markets["DOGE/USDT"] = "DOGE/USDT";
    Markets["DIDE/USDT"] = "DIDE/USDT";
})(Markets || (Markets = {}));
const ORDERBOOK = new Map();
const initMarket = (market) => {
    ORDERBOOK.set(market, new Map());
    ORDERBOOK.get(market).set("buys", []);
    ORDERBOOK.get(market).set("sells", []);
};
initMarket(Markets["BTC/USDT"]);
initMarket(Markets["ETH/USDT"]);
initMarket(Markets["DOGE/USDT"]);
initMarket(Markets["DIDE/USDT"]);
app.post("/order", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = req.body;
    const orderId = crypto_1.default.randomUUID();
    const OrderSchema = zod_1.z.object({
        userId: zod_1.z.number(),
        price: zod_1.z.number(),
        qty: zod_1.z.number(),
        orderType: zod_1.z.enum(["BUY", "SELL"]),
        market: zod_1.z.enum(Markets),
    });
    const safeOrder = OrderSchema.safeParse(body);
    if (!safeOrder.success) {
        return res.status(400).json({ err: "Invalid body" });
    }
    // 1. Lock Funds
    let lockBody;
    if (safeOrder.data.orderType === "BUY") {
        lockBody = {
            userId: safeOrder.data.userId,
            amount: safeOrder.data.price * safeOrder.data.qty,
            asset: safeOrder.data.market.split("/")[1],
            orderId,
        };
    }
    else {
        lockBody = {
            userId: safeOrder.data.userId,
            amount: safeOrder.data.qty,
            asset: safeOrder.data.market.split("/")[0],
            orderId,
        };
    }
    try {
        const lock = yield axios_1.default.post("http://localhost:3001/wallet/lock", lockBody);
        const lockData = lock.data;
        // 2. Create Order Object
        const newOrder = {
            orderId: lockData.lockRef,
            userId: safeOrder.data.userId,
            price: safeOrder.data.price,
            originalQty: safeOrder.data.qty,
            remainingQty: safeOrder.data.qty,
            orderType: safeOrder.data.orderType,
            market: safeOrder.data.market,
            timestamp: Date.now(),
        };
        const marketBook = ORDERBOOK.get(safeOrder.data.market);
        if (newOrder.orderType === "BUY") {
            marketBook.get("buys").push(newOrder);
            marketBook
                .get("buys")
                .sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
        }
        else {
            marketBook.get("sells").push(newOrder);
            marketBook
                .get("sells")
                .sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
        }
        // 4. Matching Engine
        const buys = marketBook.get("buys");
        const sells = marketBook.get("sells");
        while (buys.length > 0 && sells.length > 0) {
            const bestBuy = buys[0];
            const bestSell = sells[0];
            if (bestBuy.price < bestSell.price) {
                break;
            }
            // MATCH FOUND
            const tradeQty = Math.min(bestBuy.remainingQty, bestSell.remainingQty);
            const tradePrice = bestBuy.timestamp < bestSell.timestamp ? bestBuy.price : bestSell.price;
            // Execute Trade
            try {
                yield axios_1.default.post("http://localhost:3001/wallet/settle", {
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
                    ref: "trade_" + crypto_1.default.randomUUID(),
                });
            }
            catch (e) {
                console.error("settle failed: ", e);
                break;
            }
            console.log(`TRADE:${bestBuy.market} ${tradeQty} @ ${tradePrice} (${bestBuy.userId} buys from ${bestSell.userId})`);
            // Update Quantities
            bestBuy.remainingQty -= tradeQty;
            bestSell.remainingQty -= tradeQty;
            // Remove filled orders
            if (bestBuy.remainingQty === 0)
                buys.shift();
            if (bestSell.remainingQty === 0)
                sells.shift();
        }
        return res.json({ success: "Successfully order placed" });
    }
    catch (e) {
        return res
            .status(400)
            .json({ err: "error communicating with wallet service" });
    }
}));
app.post("/cancel", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = req.body;
    const CancelSchema = zod_1.z.object({
        orderId: zod_1.z.string(),
        userId: zod_1.z.number(),
        market: zod_1.z.enum(Markets),
    });
    const safeBody = CancelSchema.safeParse(body);
    if (!safeBody.success)
        return res.json({ err: "Invalid body" });
    const book = ORDERBOOK.get(safeBody.data.market);
    if (!book)
        return res.status(400).json({ err: "Market not found" });
    const removeFromSide = (side) => {
        const list = book.get(side);
        const index = list.findIndex((o) => o.orderId === safeBody.data.orderId);
        if (index > -1) {
            const order = list[index];
            if (order.userId !== safeBody.data.userId)
                return null;
            if (order.originalQty !== order.remainingQty)
                return null;
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
        yield axios_1.default.post("http://localhost:3001/wallet/release", {
            userId: safeBody.data.userId,
            orderId: safeBody.data.orderId,
        });
        return res.json({ success: "Successfully canceled order" });
    }
    catch (e) {
        return res.status(400).json({ err: "Wallet refused release" });
    }
}));
app.get("/markets/:symbol", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const symbol = req.params.symbol;
    const market = symbol.replace("_", "/");
    if (!ORDERBOOK.get(market)) {
        return res.status(400).json({ err: "No market found for the symbol" });
    }
    const smallOrderBook = ORDERBOOK.get(market);
    const buys = smallOrderBook.get("buys").slice(0, 20);
    const sells = smallOrderBook.get("sells").slice(0, 20);
    return res.json({ buys, sells });
}));
app.listen(PORT, () => {
    console.log(`The server is running on http://localhost:${PORT}`);
});
