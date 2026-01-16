-- CreateEnum
CREATE TYPE "Asset" AS ENUM ('USDT', 'BTC', 'ETH', 'DOGE', 'DIDD');

-- CreateEnum
CREATE TYPE "Reason" AS ENUM ('LOCK', 'RELEASE', 'DEPOSIT', 'WITHDRAWAL', 'TRADE');

-- CreateTable
CREATE TABLE "Ledger" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "asset" "Asset" NOT NULL,
    "change" DECIMAL(65,30) NOT NULL,
    "reason" "Reason" NOT NULL,
    "ref" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lock" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "asset" "Asset" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "ref" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ledger_userId_asset_idx" ON "Ledger"("userId", "asset");

-- CreateIndex
CREATE INDEX "Lock_userId_asset_idx" ON "Lock"("userId", "asset");
