import dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../src/.env" });
import express from "express";
import prisma from "./lib/prisma";
import { Prisma, Reason } from "./src/generated/prisma/client";
import { z } from "zod";
import crypto from "crypto";

const app = express();
const PORT = 3001;

const insufficient_funds = "INSUFFICIENT_FUNDS";

app.use(express.json());
app.post("/", (req, res) => {
  console.log("This is working");
  res.json({
    success: "This is working",
  });
});

app.post("/wallet/debit", async (req, res) => {
  const { amount, userId, asset } = req.body;
  const DebitSchema = z.object({
    amount: z.number().positive(),
    asset: z.enum(["USDT", "BTC", "ETH", "DOGE", "DIDE"]),
    userId: z.number(),
  });
  const safeBody = DebitSchema.safeParse({ amount, userId, asset });
  if (!safeBody.success) {
    return res.status(400).json({
      err: "Invalid body",
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.findMany({
        where: {
          userId: safeBody.data.userId,
        },
      });

      const totalBalance = ledger.reduce(
        (sum, rec) => sum + Number(rec.change),
        0
      );
      const lock = await tx.lock.findMany({
        where: {
          userId: safeBody.data.userId,
        },
      });
      const lockedBalance = lock.reduce(
        (sum, rec) => sum + Number(rec.amount),
        0
      );
      const availableBalance = totalBalance - lockedBalance;
      if (safeBody.data.amount > availableBalance) {
        throw new Error(insufficient_funds);
      }
      await tx.ledger.create({
        data: {
          userId: safeBody.data.userId,
          asset: safeBody.data.asset,
          change: `-${safeBody.data.amount}`,
          reason: Reason.WITHDRAWAL,
          ref: "withdrawal_" + crypto.randomUUID(),
        },
      });
    });
    return res.json({
      sucecss: "Withdrawal Successful",
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
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
});

app.post("/wallet/credit", async (req, res) => {
  const { amount, userId, asset } = req.body;
  const CreditSchema = z.object({
    amount: z.number().positive(),
    asset: z.enum(["USDT", "BTC", "ETH", "DOGE", "DIDE"]),
    userId: z.number(),
  });
  const safeBody = CreditSchema.safeParse({ amount, userId, asset });
  if (!safeBody.success) {
    return res.status(400).json({
      err: "Invalid body",
    });
  }
  try {
    await prisma.ledger.create({
      data: {
        userId: safeBody.data.userId,
        asset: safeBody.data.asset,
        change: `${safeBody.data.amount}`,
        reason: Reason.DEPOSIT,
        ref: "deposit_" + crypto.randomUUID(),
      },
    });
    return res.json({
      sucess: "Added credits sucessfully",
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({
        err: e.message,
      });
    }
    return res.status(500).json({
      err: "Internal server error",
    });
  }
});

app.get("/wallet/balance/:userId", async (req, res) => {
  let userId = Number(req.params.userId);
  let ledger;
  if (!userId) {
    return res.status(400).json({
      err: "Invalid userId",
    });
  }
  console.log(process.env.DATABASE_URL);
  try {
    ledger = await prisma.ledger.findMany({
      where: {
        userId: userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({
        err: "No user found",
        message: e.message,
      });
    }
    return res.status(500).json({
      err: "Internal server error",
    });
  }
  const totalBalance = ledger.reduce(
    (sum, record) => sum + Number(record.change),
    0
  );
  const lock = await prisma.lock.findMany({
    where: {
      userId: userId,
    },
  });
  const totalLocked = lock.reduce((sum, rec) => sum + Number(rec.amount), 0);
  const availableBalance = totalBalance - Number(totalLocked);
  res.json({ availableBalance: availableBalance });
});

app.listen(PORT, () => {
  console.log(`The server is running on http://localhost:${PORT}`);
});
