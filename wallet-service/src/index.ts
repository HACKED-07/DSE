import dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../src/.env" });
import express from "express";
import prisma from "./lib/prisma";
import { Asset, Prisma, Reason } from "./src/generated/prisma/client";
import { z } from "zod";
import crypto from "crypto";
import cors from "cors";
import { consumer } from "./consumer";

const app = express();
const PORT = 3001;

const insufficient_funds = "INSUFFICIENT_FUNDS";
const zodAssets = z.enum(Asset);

app.use(cors());
app.use(express.json());
app.post("/", (req, res) => {
  console.log("This is working");
  res.json({
    success: "This is working",
  });
});

app.post("/wallet/settle", async (req, res) => {
  const body = req.body;
  const settlementIdSchema = z.object({
    id: z.number(),
    amount: z.number(),
    asset: zodAssets,
    ref: z.string(),
  });
  const settleSchema = z.object({
    buyer: settlementIdSchema,
    seller: settlementIdSchema,
    ref: z.string(),
  });
  const safeBody = settleSchema.safeParse(body);
  if (!safeBody.success) {
    return res.json({
      err: "Invalid body",
    });
  }
  try {
    await prisma.$transaction(async (tx) => {
      // check if trade has already been executed
      const trade = await tx.ledger.findFirst({
        where: {
          ref: safeBody.data.ref,
        },
      });
      if (trade) {
        throw new Error("Trade already settled");
      }

      // check if the buyer lock exist's in the lock table
      const buyerLock = await tx.lock.findFirst({
        where: {
          userId: safeBody.data.buyer.id,
          ref: safeBody.data.buyer.ref,
        },
      });
      if (!buyerLock || Number(buyerLock.amount) < safeBody.data.buyer.amount) {
        throw new Error("Invalid buyer lock");
      }
      if (buyerLock.asset !== safeBody.data.buyer.asset) {
        throw new Error("Invalid buyer asset");
      }

      // check if the seller lock exist's in the lock table
      const sellerLock = await tx.lock.findFirst({
        where: {
          userId: safeBody.data.seller.id,
          ref: safeBody.data.seller.ref,
        },
      });
      if (
        !sellerLock ||
        Number(sellerLock.amount) < safeBody.data.seller.amount
      ) {
        throw new Error("Invalid seller lock");
      }

      if (sellerLock.asset !== safeBody.data.seller.asset) {
        throw new Error("Invalid seller asset");
      }

      // seller -asset record
      await tx.ledger.create({
        data: {
          userId: safeBody.data.seller.id,
          asset: safeBody.data.seller.asset,
          change: `-${safeBody.data.seller.amount}`,
          reason: Reason.TRADE,
          ref: safeBody.data.seller.ref,
        },
      });
      // buyer -asset record
      await tx.ledger.create({
        data: {
          userId: safeBody.data.buyer.id,
          asset: safeBody.data.buyer.asset,
          change: `-${safeBody.data.buyer.amount}`,
          reason: Reason.TRADE,
          ref: safeBody.data.buyer.ref,
        },
      });
      // seller +asset record
      await tx.ledger.create({
        data: {
          userId: safeBody.data.seller.id,
          asset: safeBody.data.buyer.asset,
          change: `${safeBody.data.buyer.amount}`,
          reason: Reason.TRADE,
          ref: safeBody.data.ref,
        },
      });
      // buyer +asset record
      await tx.ledger.create({
        data: {
          userId: safeBody.data.buyer.id,
          asset: safeBody.data.seller.asset,
          change: `${safeBody.data.seller.amount}`,
          reason: Reason.TRADE,
          ref: safeBody.data.ref,
        },
      });

      // release the buyer lock
      const updatedBuyerLock =
        Number(buyerLock.amount) - safeBody.data.buyer.amount;
      if (updatedBuyerLock === 0) {
        await tx.lock.delete({
          where: {
            userId: safeBody.data.buyer.id,
            asset: safeBody.data.buyer.asset,
            ref: safeBody.data.buyer.ref,
          },
        });
      } else {
        await tx.lock.update({
          where: {
            userId: safeBody.data.buyer.id,
            asset: safeBody.data.buyer.asset,
            ref: safeBody.data.buyer.ref,
          },
          data: {
            amount: String(updatedBuyerLock),
          },
        });
      }

      // release the  seller lock
      const updatedSellerLock =
        Number(sellerLock.amount) - safeBody.data.seller.amount;
      if (updatedSellerLock === 0) {
        await tx.lock.delete({
          where: {
            userId: safeBody.data.seller.id,
            asset: safeBody.data.seller.asset,
            ref: safeBody.data.seller.ref,
          },
        });
      } else {
        await tx.lock.update({
          where: {
            userId: safeBody.data.seller.id,
            asset: safeBody.data.seller.asset,
            ref: safeBody.data.seller.ref,
          },
          data: {
            amount: String(updatedSellerLock),
          },
        });
      }
    });
    return res.json({
      success: "Trade successful",
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Trade already settled") {
      return res.json({
        success: "Trade already settled",
      });
    }
    if (e instanceof Error && e.message === "Invalid seller lock") {
      return res.status(400).json({
        err: "Invalid seller lock",
      });
    }
    if (e instanceof Error && e.message === "Invalid buyer lock") {
      return res.status(400).json({
        err: "Invalid buyer lock",
      });
    }
    if (e instanceof Error && e.message === "Invalid seller asset") {
      return res.status(400).json({
        err: "Invalid seller asset",
      });
    }
    if (e instanceof Error && e.message === "Invalid buyer asset") {
      return res.status(400).json({
        err: "Invalid buyer asset",
      });
    }
    return res.status(500).json({
      err: "Internal server error",
    });
  }
});

app.post("/wallet/release", async (req, res) => {
  const { userId, orderId } = req.body;
  const releaseSchema = z.object({
    userId: z.number(),
    orderId: z.string(),
  });
  const safeBody = releaseSchema.safeParse({ userId, orderId });
  if (!safeBody.success) {
    return res.status(400).json({
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
      return res.status(400).json({
        err: "No lock of found for the request",
      });
    }
    return res.status(500).json({
      err: "Internal server error",
    });
  }
});

app.post("/wallet/lock", async (req, res) => {
  const { userId, asset, amount, orderId } = req.body;
  const lockRef = "lock_" + crypto.randomUUID();
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${safeBody.data.userId});`;

      // 1. Calculate Total Ledger Balance (SUM in DB)
      const ledgerRes = await tx.ledger.aggregate({
        where: {
          userId: safeBody.data.userId,
          asset: safeBody.data.asset,
        },
        _sum: { id: true }, // We can't sum String fields in Prisma easily without raw SQL
      });

      // Since 'change' is String, we use raw SQL for precision and speed
      const [{ sum: totalBalanceStr }] = await tx.$queryRaw<any[]>`
        SELECT SUM(CAST(change AS DECIMAL)) as sum 
        FROM "wallet"."Ledger" 
        WHERE "userId" = ${safeBody.data.userId} AND "asset" = ${safeBody.data.asset}::"wallet"."Asset"
      `;
      const totalBalance = Number(totalBalanceStr || 0);

      // 2. Calculate Locked Balance (SUM in DB)
      const [{ sum: lockedBalanceStr }] = await tx.$queryRaw<any[]>`
        SELECT SUM(CAST(amount AS DECIMAL)) as sum 
        FROM "wallet"."Lock" 
        WHERE "userId" = ${safeBody.data.userId} AND "asset" = ${safeBody.data.asset}::"wallet"."Asset"
      `;
      const lockedBalance = Number(lockedBalanceStr || 0);

      const availableBalance = totalBalance - lockedBalance;
      if (safeBody.data.amount > availableBalance) {
        throw new Error(insufficient_funds);
      }
      await tx.lock.create({
        data: {
          userId: safeBody.data.userId,
          asset: safeBody.data.asset,
          amount: String(safeBody.data.amount),
          ref: lockRef,
        },
      });
    });
    return res.json({
      success: "Successfully added lock",
      lockRef,
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return res.status(400).json({
        err: "Lock already exits",
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${safeBody.data.userId});`;

      const [{ sum: totalBalanceStr }] = await tx.$queryRaw<any[]>`
        SELECT SUM(CAST(change AS DECIMAL)) as sum 
        FROM "wallet"."Ledger" 
        WHERE "userId" = ${safeBody.data.userId} AND "asset" = ${safeBody.data.asset}::"wallet"."Asset"
      `;
      const totalBalance = Number(totalBalanceStr || 0);

      const [{ sum: lockedBalanceStr }] = await tx.$queryRaw<any[]>`
        SELECT SUM(CAST(amount AS DECIMAL)) as sum 
        FROM "wallet"."Lock" 
        WHERE "userId" = ${safeBody.data.userId} AND "asset" = ${safeBody.data.asset}::"wallet"."Asset"
      `;
      const lockedBalance = Number(lockedBalanceStr || 0);

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
    const ledgerSums = await prisma.$queryRaw<any[]>`
      SELECT asset, SUM(CAST(change AS DECIMAL)) as sum 
      FROM "wallet"."Ledger" 
      WHERE "userId" = ${userId}
      GROUP BY asset
    `;

    const lockSums = await prisma.$queryRaw<any[]>`
      SELECT asset, SUM(CAST(amount AS DECIMAL)) as sum 
      FROM "wallet"."Lock" 
      WHERE "userId" = ${userId}
      GROUP BY asset
    `;

    const balances: Record<
      string,
      { total: number; locked: number; available: number }
    > = {};

    ledgerSums.forEach((r) => {
      balances[r.asset] = {
        total: Number(r.sum),
        locked: 0,
        available: Number(r.sum),
      };
    });

    lockSums.forEach((r) => {
      if (!balances[r.asset]) {
        balances[r.asset] = {
          total: 0,
          locked: Number(r.sum),
          available: -Number(r.sum),
        };
      } else {
        balances[r.asset].locked = Number(r.sum);
        balances[r.asset].available = balances[r.asset].total - Number(r.sum);
      }
    });

    console.log(balances);
    res.json(balances);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ err: "Internal server error" });
  }
});

export const startBackgroundSettler = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "trade.settlement", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const settlementData = JSON.parse(message.value.toString());
      const ref = settlementData.ref;

      try {
        await prisma.$transaction(async (tx) => {
          // check if trade has already been executed
          const trade = await tx.ledger.findFirst({
            where: { ref },
          });

          if (trade) {
            console.log(`Trade ${ref} already settled, skipping.`);
            return;
          }

          const { buyer, seller } = settlementData;

          // check if the buyer lock exists
          const buyerLock = await tx.lock.findUnique({
            where: { ref: buyer.ref },
          });

          if (!buyerLock || Number(buyerLock.amount) < buyer.amount) {
            throw new Error(`Invalid buyer lock: ${buyer.ref}`);
          }

          // check if the seller lock exists
          const sellerLock = await tx.lock.findUnique({
            where: { ref: seller.ref },
          });

          if (!sellerLock || Number(sellerLock.amount) < seller.amount) {
            throw new Error(`Invalid seller lock: ${seller.ref}`);
          }

          // 1. Debit Seller
          await tx.ledger.create({
            data: {
              userId: seller.id,
              asset: seller.asset,
              change: `-${seller.amount}`,
              reason: Reason.TRADE,
              ref: seller.ref,
            },
          });

          // 2. Debit Buyer
          await tx.ledger.create({
            data: {
              userId: buyer.id,
              asset: buyer.asset,
              change: `-${buyer.amount}`,
              reason: Reason.TRADE,
              ref: buyer.ref,
            },
          });

          // 3. Credit Seller (Buyer's Asset)
          await tx.ledger.create({
            data: {
              userId: seller.id,
              asset: buyer.asset,
              change: `${buyer.amount}`,
              reason: Reason.TRADE,
              ref: ref,
            },
          });

          // 4. Credit Buyer (Seller's Asset)
          await tx.ledger.create({
            data: {
              userId: buyer.id,
              asset: seller.asset,
              change: `${seller.amount}`,
              reason: Reason.TRADE,
              ref: ref,
            },
          });

          // Update/Delete Buyer Lock
          const updatedBuyerAmount = Number(buyerLock.amount) - buyer.amount;
          if (updatedBuyerAmount <= 0) {
            await tx.lock.delete({ where: { ref: buyer.ref } });
          } else {
            await tx.lock.update({
              where: { ref: buyer.ref },
              data: { amount: String(updatedBuyerAmount) },
            });
          }

          // Update/Delete Seller Lock
          const updatedSellerAmount = Number(sellerLock.amount) - seller.amount;
          if (updatedSellerAmount <= 0) {
            await tx.lock.delete({ where: { ref: seller.ref } });
          } else {
            await tx.lock.update({
              where: { ref: seller.ref },
              data: { amount: String(updatedSellerAmount) },
            });
          }
        });

        console.log(`Successfully settled trade: ${ref}`);
      } catch (e: any) {
        console.error(`Failed to settle trade ${ref}:`, e.message);
      }
    },
  });
};

app.listen(PORT, async () => {
  console.log(`The server is running on http://localhost:${PORT}`);
  await startBackgroundSettler();
  console.log("Background settler started");
});
