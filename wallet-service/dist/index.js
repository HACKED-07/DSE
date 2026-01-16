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
const crypto_1 = __importDefault(require("crypto"));
const app = (0, express_1.default)();
const PORT = 3001;
app.use(express_1.default.json());
app.post("/", (req, res) => {
    console.log("This is working");
    res.json({
        success: "This is working",
    });
});
app.post("/wallet/debit", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { amount, userId, asset } = req.body;
    const DebitSchema = zod_1.z.object({
        amount: zod_1.z.number().positive(),
        asset: zod_1.z.enum(["USDT", "BTC", "ETH", "DOGE", "DIDE"]),
        userId: zod_1.z.number(),
    });
    const safeBody = DebitSchema.safeParse({ amount, userId, asset });
    if (!safeBody.success) {
        return res.json({
            err: "Invalid body",
        });
    }
    prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const ledger = yield tx.ledger.findMany({
                where: {
                    userId: safeBody.data.userId,
                },
            });
            const totalBalance = ledger.reduce((sum, rec) => sum + Number(rec.change), 0);
            const lock = yield tx.lock.findMany({
                where: {
                    userId: safeBody.data.userId,
                },
            });
            const lockedBalance = lock.reduce((sum, rec) => sum + Number(rec.amount), 0);
            const availableBalance = totalBalance - lockedBalance;
            if (safeBody.data.amount > availableBalance) {
                return res.json({
                    err: "Insufficient funds",
                });
            }
            yield tx.ledger.create({
                data: {
                    userId: safeBody.data.userId,
                    asset: safeBody.data.asset,
                    change: `-${safeBody.data.amount}`,
                    reason: client_1.Reason.WITHDRAWAL,
                    ref: "withdrawal_" + crypto_1.default.randomUUID(),
                },
            });
            return res.json({
                sucecss: "Successfully withdrawaled money",
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                return res.json({
                    err: "Error in withdrawaling",
                });
            }
            return res.json({
                err: "Internal server error",
            });
        }
    }));
}));
app.post("/wallet/credit", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { amount, userId, asset } = req.body;
    const CreditSchema = zod_1.z.object({
        amount: zod_1.z.number().positive(),
        asset: zod_1.z.enum(["USDT", "BTC", "ETH", "DOGE", "DIDE"]),
        userId: zod_1.z.number(),
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
                ref: "deposit_" + crypto_1.default.randomUUID(),
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
    let ledger;
    if (!userId) {
        return res.json({
            err: "Invalid userId",
        });
    }
    console.log(process.env.DATABASE_URL);
    try {
        ledger = yield prisma_1.default.ledger.findMany({
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
    const totalBalance = ledger.reduce((sum, record) => sum + Number(record.change), 0);
    const lock = yield prisma_1.default.lock.findMany({
        where: {
            userId: userId,
        },
    });
    const totalLocked = lock.reduce((sum, rec) => sum + Number(rec.amount), 0);
    const availableBalance = totalBalance - Number(totalLocked);
    res.json({ availableBalance: availableBalance });
}));
app.listen(PORT, () => {
    console.log(`The server is running on http://localhost:${PORT}`);
});
