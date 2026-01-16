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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: __dirname + "/../src/.env" });
const express_1 = __importDefault(require("express"));
const prisma_1 = __importDefault(require("./lib/prisma"));
const client_1 = require("./src/generated/prisma/client");
const zod_1 = require("zod");
const app = (0, express_1.default)();
const PORT = 3001;
app.use(express_1.default.json());
app.post("/", (req, res) => {
    console.log("This is working");
    res.json({
        success: "This is working",
    });
});
app.post("/wallet/credit", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { amount, userId, asset } = req.body;
    const CreditSchema = zod_1.z.object({
        amount: (0, zod_1.number)().positive(),
        asset: zod_1.z.enum(["USDT", "BTC", "ETH", "DOGE", "DIDE"]),
        userId: (0, zod_1.number)(),
    });
    const safeBody = CreditSchema.safeParse({ amount, userId, asset });
    if (!safeBody.success) {
        return res.json({
            err: "Invalid body",
        });
    }
    try {
        yield prisma_1.default.ledger.create({
            data: {
                userId: safeBody.data.userId,
                asset: safeBody.data.asset,
                change: `${safeBody.data.amount}`,
                reason: client_1.Reason.DEPOSIT,
                ref: "deposit_" + crypto.randomUUID(),
            },
        });
        return res.json({
            sucess: "Added credits sucessfully",
        });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return res.json({
                err: e.message,
            });
        }
        return res.json({
            err: "Internal server error",
        });
    }
}));
app.get("/wallet/balance/:userId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let userId = Number(req.params.userId);
    let user;
    if (!userId) {
        return res.json({
            err: "Invalid userId",
        });
    }
    console.log(process.env.DATABASE_URL);
    try {
        user = yield prisma_1.default.ledger.findMany({
            where: {
                userId: userId,
            },
        });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return res.json({
                err: "No user found",
                message: e.message,
            });
        }
        return res.json({
            err: "Internal server error",
        });
    }
    const netBalance = user.reduce((sum, record) => sum + Number(record.change), 0);
    const lockedBalance = user
        .filter((r) => r.reason === "LOCK")
        .reduce((sum, record) => sum + Number(record.change), 0);
    const availableBalance = netBalance - lockedBalance;
    res.json({ availableBalance: availableBalance });
}));
app.listen(PORT, () => {
    console.log(`The server is running on http://localhost:${PORT}`);
});
