import z from "zod";
import { insufficient_funds } from "../errors/customErrors";
import prisma from "../lib/prisma";
import { Asset, Reason } from "../src/generated/prisma/enums";
import crypto from "crypto";

// Hash a string userId to a numeric value for pg_advisory_xact_lock
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash;
}

export const zodAssets = z.enum(Asset);
export type AssetType = z.infer<typeof zodAssets>;

export const creditUser = async (
  amount: number,
  asset: AssetType,
  userId: string,
) => {
  const record = await prisma.ledger.create({
    data: {
      userId: userId,
      asset: asset,
      change: `${amount}`,
      reason: Reason.DEPOSIT,
      ref: "deposit_" + crypto.randomUUID(),
    },
  });

  return record;
};

export const debitUser = async (
  amount: number,
  asset: AssetType,
  userId: string,
) => {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashUserId(userId)});`;

    const ledgers = await tx.ledger.findMany({
      where: {
        userId: userId,
        asset: asset,
      },
      select: { change: true },
    });
    const totalBalance = ledgers.reduce(
      (acc, curr) => acc + Number(curr.change),
      0,
    );

    const locks = await tx.lock.findMany({
      where: {
        userId: userId,
        asset: asset,
      },
      select: { amount: true },
    });
    const lockedBalance = locks.reduce(
      (acc, curr) => acc + Number(curr.amount),
      0,
    );

    const availableBalance = totalBalance - lockedBalance;
    if (amount > availableBalance) {
      throw new Error(insufficient_funds);
    }
    const record = await tx.ledger.create({
      data: {
        userId: userId,
        asset: asset,
        change: `-${amount}`,
        reason: Reason.WITHDRAWAL,
        ref: "withdrawal_" + crypto.randomUUID(),
      },
    });
    return record;
  });
};

export const lockFunds = async (
  userId: string,
  amount: number,
  asset: AssetType,
  orderId: string,
) => {
  const lockRef = "lock_" + crypto.randomUUID();
  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashUserId(userId)});`;

    // 1. Calculate Total Ledger Balance
    const ledgers = await tx.ledger.findMany({
      where: {
        userId: userId,
        asset: asset,
      },
      select: { change: true },
    });
    const totalBalance = ledgers.reduce(
      (acc, curr) => acc + Number(curr.change),
      0,
    );

    // 2. Calculate Locked Balance
    const locks = await tx.lock.findMany({
      where: {
        userId: userId,
        asset: asset,
      },
      select: { amount: true },
    });
    const lockedBalance = locks.reduce(
      (acc, curr) => acc + Number(curr.amount),
      0,
    );

    const availableBalance = totalBalance - lockedBalance;
    if (amount > availableBalance) {
      throw new Error(insufficient_funds);
    }
    const lock = await tx.lock.create({
      data: {
        userId: userId,
        asset: asset,
        amount: String(amount),
        ref: lockRef,
      },
    });
    return lock;
  });
};

export const releaseFunds = async (userId: string, orderId: string) => {
  await prisma.lock.deleteMany({
    where: {
      userId: userId,
      ref: orderId,
    },
  });
};

export const getUserBalance = async (userId: string) => {
  const ledgers = await prisma.ledger.findMany({
    where: { userId },
    select: { asset: true, change: true },
  });

  const locks = await prisma.lock.findMany({
    where: { userId },
    select: { asset: true, amount: true },
  });

  const balances: Record<
    string,
    { total: number; locked: number; available: number }
  > = {};

  ledgers.forEach((ledger) => {
    if (!balances[ledger.asset]) {
      balances[ledger.asset] = { total: 0, locked: 0, available: 0 };
    }
    balances[ledger.asset].total += Number(ledger.change);
    balances[ledger.asset].available += Number(ledger.change);
  });

  locks.forEach((lock) => {
    if (!balances[lock.asset]) {
      balances[lock.asset] = { total: 0, locked: 0, available: 0 };
    }
    balances[lock.asset].locked += Number(lock.amount);
    balances[lock.asset].available -= Number(lock.amount);
  });

  return balances;
};

