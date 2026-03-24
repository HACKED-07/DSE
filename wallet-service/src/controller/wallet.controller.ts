import z from "zod";
import { Request, Response } from "express";
import {
  creditUser,
  debitUser,
  lockFunds,
  releaseFunds,
  getUserBalance,
  zodAssets,
} from "../services/wallet.service";
import { settleTrade } from "../services/settlement.service";
import { Prisma } from "../src/generated/prisma/client";
import { insufficient_funds } from "../errors/customErrors";

const CreditSchema = z.object({
  amount: z.number().positive(),
  asset: zodAssets,
  userId: z.string(),
});

const DebitSchema = z.object({
  amount: z.number().positive(),
  asset: zodAssets,
  userId: z.string(),
});

const LockSchema = z.object({
  userId: z.string(),
  amount: z.number().positive(),
  asset: zodAssets,
  orderId: z.string(),
});

const ReleaseSchema = z.object({
  userId: z.string(),
  orderId: z.string(),
});

const settlementIdSchema = z.object({
  id: z.string(),
  amount: z.number(),
  asset: zodAssets,
  ref: z.string(),
});
const SettleSchema = z.object({
  buyer: settlementIdSchema,
  seller: settlementIdSchema,
  ref: z.string(),
});

export const handleCredit = async (req: Request, res: Response) => {
  const safeBody = CreditSchema.safeParse(req.body);

  if (!safeBody.success) {
    return res.status(400).json({ err: "Invalid body" });
  }

  try {
    const { amount, asset, userId } = safeBody.data;

    await creditUser(amount, asset, userId);
    return res.json({ success: "Added credits successfully" });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({ err: e.message });
    }
    return res.status(500).json({ err: "Internal server error" });
  }
};

export const handleDebit = async (req: Request, res: Response) => {
  const safeBody = DebitSchema.safeParse(req.body);
  if (!safeBody.success) {
    return res.status(400).json({ err: "Invalid body" });
  }

  try {
    const { amount, asset, userId } = safeBody.data;
    await debitUser(amount, asset, userId);
    return res.json({ success: "Withdrawal successful" });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({ err: "Error in withdrawal" });
    }
    if (e instanceof Error && e.message === insufficient_funds) {
      return res.status(400).json({ err: "Insufficient funds" });
    }
    return res.status(500).json({ err: "Internal server error" });
  }
};

export const handleLock = async (req: Request, res: Response) => {
  const safeBody = LockSchema.safeParse(req.body);
  if (!safeBody.success) {
    return res.status(400).json({ err: "Invalid body" });
  }
  try {
    const { amount, asset, userId, orderId } = safeBody.data;
    const lock = await lockFunds(userId, amount, asset, orderId);
    return res.json({
      success: "Successfully added lock",
      lockRef: lock.ref,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(400).json({ err: "Lock already exists" });
    }
    if (e instanceof Error && e.message === insufficient_funds) {
      return res.status(400).json({ err: "Insufficient Funds" });
    }
    return res.status(500).json({ err: "Internal server error" });
  }
};

export const handleRelease = async (req: Request, res: Response) => {
  const safeBody = ReleaseSchema.safeParse(req.body);
  if (!safeBody.success) {
    return res.status(400).json({ err: "Invalid body" });
  }
  try {
    await releaseFunds(safeBody.data.userId, safeBody.data.orderId);
    return res.json({ success: "Successfully released" });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({ err: "No lock found for the request" });
    }
    return res.status(500).json({ err: "Internal server error" });
  }
};

export const handleBalance = async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  if (!userId) {
    return res.status(400).json({ err: "Invalid userId" });
  }
  try {
    const balances = await getUserBalance(userId);
    res.json(balances);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ err: "Internal server error" });
  }
};

export const handleSettle = async (req: Request, res: Response) => {
  const body = req.body;
  const safeBody = SettleSchema.safeParse(body);
  if (!safeBody.success) {
    return res.status(400).json({ err: "Invalid body" });
  }
  try {
    const { buyer, seller, ref } = safeBody.data;
    await settleTrade(buyer, seller, ref);
    return res.json({ success: "Trade successful" });
  } catch (e) {
    if (e instanceof Error && e.message === "Trade already settled") {
      return res.json({ success: "Trade already settled" });
    }
    if (e instanceof Error && e.message === "Invalid seller lock") {
      return res.status(400).json({ err: "Invalid seller lock" });
    }
    if (e instanceof Error && e.message === "Invalid buyer lock") {
      return res.status(400).json({ err: "Invalid buyer lock" });
    }
    if (e instanceof Error && e.message === "Invalid seller asset") {
      return res.status(400).json({ err: "Invalid seller asset" });
    }
    if (e instanceof Error && e.message === "Invalid buyer asset") {
      return res.status(400).json({ err: "Invalid buyer asset" });
    }
    return res.status(500).json({ err: "Internal server error" });
  }
};
