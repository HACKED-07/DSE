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
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = 3002;
var Markets;
(function (Markets) {
    Markets["BTC/USDT"] = "BTC/USDT";
    Markets["ETH/USDT"] = "ETH/USDT";
    Markets["DOGE/USDT"] = "DOGE/USDT";
    Markets["DIDE/USDT"] = "DIDE/USDT";
})(Markets || (Markets = {}));
const ORDERBOOK = new Map();
ORDERBOOK.set(Markets["BTC/USDT"], new Map());
ORDERBOOK.get(Markets["BTC/USDT"]).set("buys", []);
ORDERBOOK.get(Markets["BTC/USDT"]).set("sells", []);
ORDERBOOK.set(Markets["DIDE/USDT"], new Map());
ORDERBOOK.get(Markets["DIDE/USDT"]).set("buys", []);
ORDERBOOK.get(Markets["DIDE/USDT"]).set("sells", []);
ORDERBOOK.set(Markets["DOGE/USDT"], new Map());
ORDERBOOK.get(Markets["DOGE/USDT"]).set("buys", []);
ORDERBOOK.get(Markets["DOGE/USDT"]).set("sells", []);
ORDERBOOK.set(Markets["ETH/USDT"], new Map());
ORDERBOOK.get(Markets["ETH/USDT"]).set("buys", []);
ORDERBOOK.get(Markets["ETH/USDT"]).set("sells", []);
app.post("/order", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
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
    }
    else {
        lockBody = {
            userId: safeOrder.data.userId,
            amount: safeOrder.data.qty,
            asset: safeOrder.data.market.split("/")[0],
            orderId,
        };
    }
    const lock = yield axios_1.default.post("http://localhost:3001/wallet/lock", lockBody);
    if (!lock) {
        return res.status(400).json({
            err: "error communicating with wallet service",
        });
    }
    const lockData = lock.data;
    // push the new order to the order book
    if (safeOrder.data.orderType === "BUY") {
        ORDERBOOK.get(Markets["BTC/USDT"]).get("buys").push({
            orderId: lockData.lockRef,
            userId: safeOrder.data.userId,
            price: safeOrder.data.price,
            originalQty: safeOrder.data.qty,
            remainingQty: safeOrder.data.qty,
            orderType: "BUY",
            market: safeOrder.data.market,
        });
    }
    else {
        ORDERBOOK.get(Markets["BTC/USDT"]).get("sells").push({
            orderId: lockData.lockRef,
            userId: safeOrder.data.userId,
            price: safeOrder.data.price,
            originalQty: safeOrder.data.qty,
            remainingQty: safeOrder.data.qty,
            orderType: "SELL",
            market: safeOrder.data.market,
        });
    }
    const buyBTCOrders = ORDERBOOK.get(Markets["BTC/USDT"]).get("buys");
    const sellBTCOrders = ORDERBOOK.get(Markets["BTC/USDT"]).get("sells");
    if (!(buyBTCOrders === null || buyBTCOrders === void 0 ? void 0 : buyBTCOrders.length) || !(sellBTCOrders === null || sellBTCOrders === void 0 ? void 0 : sellBTCOrders.length)) {
        return res.json({
            success: "Order placed but orderbook empty",
        });
    }
    const sortBuyBTCOrders = buyBTCOrders === null || buyBTCOrders === void 0 ? void 0 : buyBTCOrders.sort((a, b) => b.price - a.price);
    const sortSellBTCOrders = sellBTCOrders === null || sellBTCOrders === void 0 ? void 0 : sellBTCOrders.sort((a, b) => a.price - b.price);
    while ((sortBuyBTCOrders === null || sortBuyBTCOrders === void 0 ? void 0 : sortBuyBTCOrders.length) &&
        (sortSellBTCOrders === null || sortSellBTCOrders === void 0 ? void 0 : sortSellBTCOrders.length) &&
        sortBuyBTCOrders[0].price >= sortSellBTCOrders[0].price) {
        const tradeQty = sortBuyBTCOrders[0].remainingQty > sortSellBTCOrders[0].remainingQty
            ? sortSellBTCOrders[0].remainingQty
            : sortBuyBTCOrders[0].remainingQty;
        const tradePrice = sortSellBTCOrders[0].price;
        console.log(ORDERBOOK.get(Markets["BTC/USDT"]));
        yield axios_1.default.post("http://localhost:3001/wallet/settle", {
            buyer: {
                id: ORDERBOOK.get(Markets["BTC/USDT"]).get("buys")[0].userId,
                amount: tradePrice * tradeQty,
                asset: ORDERBOOK.get(Markets["BTC/USDT"])
                    .get("buys")[0]
                    .market.split("/")[1],
                ref: (_a = ORDERBOOK.get(Markets["BTC/USDT"])) === null || _a === void 0 ? void 0 : _a.get("buys")[0].orderId,
            },
            seller: {
                id: ORDERBOOK.get(Markets["BTC/USDT"]).get("sells")[0].userId,
                amount: tradeQty,
                asset: ORDERBOOK.get(Markets["BTC/USDT"])
                    .get("sells")[0]
                    .market.split("/")[0],
                ref: (_b = ORDERBOOK.get(Markets["BTC/USDT"])) === null || _b === void 0 ? void 0 : _b.get("sells")[0].orderId,
            },
            ref: "trade_" + orderId,
        });
        if (sortBuyBTCOrders[0].remainingQty >= sortSellBTCOrders[0].remainingQty) {
            sortBuyBTCOrders[0].remainingQty =
                sortBuyBTCOrders[0].remainingQty - sortSellBTCOrders[0].remainingQty;
        }
        else {
            sortSellBTCOrders[0].remainingQty =
                sortSellBTCOrders[0].remainingQty - sortBuyBTCOrders[0].remainingQty;
        }
        if (sortBuyBTCOrders[0].remainingQty === 0) {
            ORDERBOOK.get(Markets["BTC/USDT"]).get("buys").shift();
        }
        if (sortSellBTCOrders[0].remainingQty === 0) {
            ORDERBOOK.get(Markets["BTC/USDT"]).get("sells").shift();
        }
    }
    //   console.log(sortBuyBTCOrders, "   ", sortSellBTCOrders);
    return res.json({
        success: "Succesfully order placed",
    });
}));
app.listen(PORT, () => {
    console.log(`The server is running on http://localhost:${PORT}`);
});
