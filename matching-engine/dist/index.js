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
const ORDERBOOK = new Map();
ORDERBOOK.set("BTC/USDT", new Map());
ORDERBOOK.get("BTC/USDT").set("buys", []);
ORDERBOOK.get("BTC/USDT").set("sells", []);
ORDERBOOK.set("DIDE/USDT", new Map());
ORDERBOOK.get("DIDE/USDT").set("buys", []);
ORDERBOOK.get("DIDE/USDT").set("sells", []);
ORDERBOOK.set("DOGE/USDT", new Map());
ORDERBOOK.get("DOGE/USDT").set("buys", []);
ORDERBOOK.get("DOGE/USDT").set("sells", []);
ORDERBOOK.set("ETH/USDT", new Map());
ORDERBOOK.get("ETH/USDT").set("buys", []);
ORDERBOOK.get("ETH/USDT").set("sells", []);
app.post("/order", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = req.body;
    const orderId = crypto_1.default.randomUUID();
    const OrderSchema = zod_1.z.object({
        userId: zod_1.z.number(),
        price: zod_1.z.number(),
        qty: zod_1.z.number(),
        orderType: zod_1.z.enum(["BUY", "SELL"]),
        market: zod_1.z.string(),
    });
    const safeOrder = OrderSchema.safeParse(body);
    if (!safeOrder.success) {
        return res.status(400).json({
            err: "Invalid body",
        });
    }
    console.log("This is working");
    // Lock before adding order to order book
    const data = yield axios_1.default.post("http://localhost:3001/wallet/lock", {
        userId: safeOrder.data.userId,
        amount: safeOrder.data.price * safeOrder.data.qty,
        asset: safeOrder.data.market.split("/")[1],
        orderId,
    });
    console.log(data);
    const buyBTCOrders = ORDERBOOK.get("BTC/USDT").get("buys");
    const sellBTCOrders = ORDERBOOK.get("BTC/USDT").get("sells");
    const sortBuyBTCOrders = buyBTCOrders === null || buyBTCOrders === void 0 ? void 0 : buyBTCOrders.sort((a, b) => b.price - a.price);
    const sortSellBTCOrders = sellBTCOrders === null || sellBTCOrders === void 0 ? void 0 : sellBTCOrders.sort((a, b) => a.price - b.price);
}));
app.listen(PORT, () => {
    console.log(`The server is running on http://localhost:${PORT}`);
});
