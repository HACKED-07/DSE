import dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../src/.env" });
import express from "express";
import prisma from "./lib/prisma";
import { Asset, Prisma, Reason } from "./src/generated/prisma/client";
import { z } from "zod";
import crypto from "crypto";

const app = express();
const PORT = 3001;

const insufficient_funds = "INSUFFICIENT_FUNDS";
const zodAssets = z.enum(Asset);

app.use(express.json());
app.post("/", (req, res) => {
  console.log("This is working");
  res.json({
    success: "This is working",
  });
});

app.post("/wallet/release", async (req, res) => {
  const { userId, asset, amount, orderId } = req.body;
  const releaseSchema = z.object({
    userId: z.number(),
    asset: zodAssets,
    amount: z.number().positive(),
    orderId: z.string(),
  });
  const safeBody = releaseSchema.safeParse({ userId, asset, amount, orderId });
  if (!safeBody.success) {
    return res.json({
      err: "Invalid body",
    });
  }
  try {
    await prisma.lock.deleteMany({
      where: {
        userId: safeBody.data.userId,
        ref: safeBody.data.orderId,
      },
    });
    return res.json({
      success: "Successfully released",
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return res.json({
        err: "No lock of found for the request",
      });
    }
  }
});

app.post("/wallet/lock", async (req, res) => {
  const { userId, asset, amount, orderId } = req.body;
  const LockSchema = z.object({
    userId: z.number(),
    amount: z.number(),
    asset: zodAssets,
    orderId: z.string(),
  });
  const safeBody = LockSchema.safeParse({ userId, asset, amount, orderId });
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
          asset: safeBody.data.asset,
        },
      });
      const totalBalance = ledger.reduce(
        (sum, rec) => sum + Number(rec.change),
        0
      );
      const lock = await tx.lock.findMany({
        where: {
          userId: safeBody.data.userId,
          asset: safeBody.data.asset,
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
      await tx.lock.create({
        data: {
          userId: safeBody.data.userId,
          asset: safeBody.data.asset,
          amount: String(safeBody.data.amount),
          ref: safeBody.data.orderId,
        },
      });
    });
    return res.json({
      success: "Successfully added lock",
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
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
});

app.post("/wallet/debit", async (req, res) => {
  const { amount, userId, asset } = req.body;
  const DebitSchema = z.object({
    amount: z.number().positive(),
    asset: zodAssets,
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
          asset: safeBody.data.asset,
        },
      });

      const totalBalance = ledger.reduce(
        (sum, rec) => sum + Number(rec.change),
        0
      );
      const lock = await tx.lock.findMany({
        where: {
          userId: safeBody.data.userId,
          asset: safeBody.data.asset,
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
    asset: zodAssets,
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
  const balances: Record<
    string,
    {
      total: number;
      locked: number;
      available: number;
    }
  > = {};
  for (const r of ledger) {
    const asset = r.asset;
    if (!balances[asset]) {
      balances[asset] = { total: 0, locked: 0, available: 0 };
    }
    balances[asset].total += Number(r.change);
  }

  const totalBalance = ledger.reduce((sum, rec) => sum + Number(rec.change), 0);
  const lock = await prisma.lock.findMany({
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
});

app.listen(PORT, () => {
  console.log(`The server is running on http://localhost:${PORT}`);
});
