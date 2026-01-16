import dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../src/.env" });
import express from "express";
import prisma from "./lib/prisma";
import { Prisma, Reason } from "./src/generated/prisma/client";
import { number, z } from "zod";

const app = express();
const PORT = 3001;

app.use(express.json());
app.post("/", (req, res) => {
  console.log("This is working");
  res.json({
    success: "This is working",
  });
});

app.post("/wallet/credit", async (req, res) => {
  const { amount, userId, asset } = req.body;
  const CreditSchema = z.object({
    amount: number().positive(),
    asset: z.enum(["USDT", "BTC", "ETH", "DOGE", "DIDE"]),
    userId: number(),
  });
  const safeBody = CreditSchema.safeParse({ amount, userId, asset });
  if (!safeBody.success) {
    return res.json({
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
      return res.json({
        err: e.message,
      });
    }
    return res.json({
      err: "Internal server error",
    });
  }
});

app.get("/wallet/balance/:userId", async (req, res) => {
  let userId = Number(req.params.userId);
  let user;
  if (!userId) {
    return res.json({
      err: "Invalid userId",
    });
  }
  console.log(process.env.DATABASE_URL);
  try {
    user = await prisma.ledger.findMany({
      where: {
        userId: userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return res.json({
        err: "No user found",
        message: e.message,
      });
    }
    return res.json({
      err: "Internal server error",
    });
  }
  const netBalance = user.reduce(
    (sum, record) => sum + Number(record.change),
    0
  );
  const lockedBalance = user
    .filter((r) => r.reason === "LOCK")
    .reduce((sum, record) => sum + Number(record.change), 0);
  const availableBalance = netBalance + lockedBalance;
  res.json({ availableBalance: availableBalance });
});

app.listen(PORT, () => {
  console.log(`The server is running on http://localhost:${PORT}`);
});
