/*
  Warnings:

  - The values [DIDD] on the enum `Asset` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Asset_new" AS ENUM ('USDT', 'BTC', 'ETH', 'DOGE', 'DIDE');
ALTER TABLE "Ledger" ALTER COLUMN "asset" TYPE "Asset_new" USING ("asset"::text::"Asset_new");
ALTER TABLE "Lock" ALTER COLUMN "asset" TYPE "Asset_new" USING ("asset"::text::"Asset_new");
ALTER TYPE "Asset" RENAME TO "Asset_old";
ALTER TYPE "Asset_new" RENAME TO "Asset";
DROP TYPE "wallet"."Asset_old";
COMMIT;
