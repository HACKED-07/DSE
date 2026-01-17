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
const insufficient_funds = "INSUFFICIENT_FUNDS";
const zodAssets = zod_1.z.enum(client_1.Asset);
app.use(express_1.default.json());
app.post("/", (req, res) => {
    console.log("This is working");
    res.json({
        success: "This is working",
    });
});
app.post("/wallet/release", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, asset, amount, orderId } = req.body;
    const releaseSchema = zod_1.z.object({
        userId: zod_1.z.number(),
        asset: zodAssets,
        amount: zod_1.z.number().positive(),
        orderId: zod_1.z.string(),
    });
    const safeBody = releaseSchema.safeParse({ userId, asset, amount, orderId });
    if (!safeBody.success) {
        return res.json({
            err: "Invalid body",
        });
    }
    try {
        yield prisma_1.default.lock.deleteMany({
            where: {
                userId: safeBody.data.userId,
                ref: safeBody.data.orderId,
            },
        });
        return res.json({
            success: "Successfully released",
        });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return res.json({
                err: "No lock of found for the request",
            });
        }
    }
}));
app.post("/wallet/lock", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, asset, amount, orderId } = req.body;
    const LockSchema = zod_1.z.object({
        userId: zod_1.z.number(),
        amount: zod_1.z.number(),
        asset: zodAssets,
        orderId: zod_1.z.string(),
    });
    const safeBody = LockSchema.safeParse({ userId, asset, amount, orderId });
    if (!safeBody.success) {
        return res.status(400).json({
            err: "Invalid body",
        });
    }
    try {
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const ledger = yield tx.ledger.findMany({
                where: {
                    userId: safeBody.data.userId,
                    asset: safeBody.data.asset,
                },
            });
            const totalBalance = ledger.reduce((sum, rec) => sum + Number(rec.change), 0);
            const lock = yield tx.lock.findMany({
                where: {
                    userId: safeBody.data.userId,
                    asset: safeBody.data.asset,
                },
            });
            const lockedBalance = lock.reduce((sum, rec) => sum + Number(rec.amount), 0);
            const availableBalance = totalBalance - lockedBalance;
            if (safeBody.data.amount > availableBalance) {
                throw new Error(insufficient_funds);
            }
            yield tx.lock.create({
                data: {
                    userId: safeBody.data.userId,
                    asset: safeBody.data.asset,
                    amount: String(safeBody.data.amount),
                    ref: safeBody.data.orderId,
                },
            });
        }));
        return res.json({
            success: "Successfully added lock",
        });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002") {
            return res.status(400).json({
                success: "Lock already exits",
            });
        }
        if (e instanceof Error && e.message === insufficient_funds) {
            return res.status(400).json({
                err: "Insufficient Funds",
            });
        }
        return res.status(500).json({
            err: "Internal server error",
        });
    }
}));
app.post("/wallet/debit", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { amount, userId, asset } = req.body;
    const DebitSchema = zod_1.z.object({
        amount: zod_1.z.number().positive(),
        asset: zodAssets,
        userId: zod_1.z.number(),
    });
    const safeBody = DebitSchema.safeParse({ amount, userId, asset });
    if (!safeBody.success) {
        return res.status(400).json({
            err: "Invalid body",
        });
    }
    try {
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const ledger = yield tx.ledger.findMany({
                where: {
                    userId: safeBody.data.userId,
                    asset: safeBody.data.asset,
                },
            });
            const totalBalance = ledger.reduce((sum, rec) => sum + Number(rec.change), 0);
            const lock = yield tx.lock.findMany({
                where: {
                    userId: safeBody.data.userId,
                    asset: safeBody.data.asset,
                },
            });
            const lockedBalance = lock.reduce((sum, rec) => sum + Number(rec.amount), 0);
            const availableBalance = totalBalance - lockedBalance;
            if (safeBody.data.amount > availableBalance) {
                throw new Error(insufficient_funds);
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
        }));
        return res.json({
            sucecss: "Withdrawal Successful",
        });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return res.status(400).json({
                err: "Error in withdrawaling",
            });
        }
        if (e instanceof Error && e.message === insufficient_funds) {
            return res.status(400).json({
                err: "Insufficient funds",
            });
        }
        return res.status(500).json({
            err: "Internal server error",
        });
    }
}));
app.post("/wallet/credit", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { amount, userId, asset } = req.body;
    const CreditSchema = zod_1.z.object({
        amount: zod_1.z.number().positive(),
        asset: zodAssets,
        userId: zod_1.z.number(),
    });
    const safeBody = CreditSchema.safeParse({ amount, userId, asset });
    if (!safeBody.success) {
        return res.status(400).json({
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
            return res.status(400).json({
                err: e.message,
            });
        }
        return res.status(500).json({
            err: "Internal server error",
        });
    }
}));
app.get("/wallet/balance/:userId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let userId = Number(req.params.userId);
    let ledger;
    if (!userId) {
        return res.status(400).json({
            err: "Invalid userId",
        });
    }
    try {
        ledger = yield prisma_1.default.ledger.findMany({
            where: {
                userId: userId,
            },
        });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return res.status(400).json({
                err: "No user found",
                message: e.message,
            });
        }
        return res.status(500).json({
            err: "Internal server error",
        });
    }
    const balances = {};
    for (const r of ledger) {
        const asset = r.asset;
        if (!balances[asset]) {
            balances[asset] = { total: 0, locked: 0, available: 0 };
        }
        balances[asset].total += Number(r.change);
    }
    const totalBalance = ledger.reduce((sum, rec) => sum + Number(rec.change), 0);
    const lock = yield prisma_1.default.lock.findMany({
        where: {
            userId: userId,
        },
    });
    for (const r of lock) {
        const asset = r.asset;
        if (!balances[asset]) {
            balances[asset] = {
                total: 0,
                locked: 0,
                available: 0,
            };
        }
        balances[asset].locked += Number(r.amount);
    }
    for (const r in balances) {
        balances[r].available = balances[r].total - balances[r].locked;
    }
    console.log(balances);
    const totalLocked = lock.reduce((sum, rec) => sum + Number(rec.amount), 0);
    const availableBalance = totalBalance - Number(totalLocked);
    res.json({ availableBalance: availableBalance });
}));
app.listen(PORT, () => {
    console.log(`The server is running on http://localhost:${PORT}`);
});
