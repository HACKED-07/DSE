/*
  Warnings:

  - The values [LOCK,RELEASE] on the enum `Reason` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[ref]` on the table `Lock` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Reason_new" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRADE');
ALTER TABLE "Ledger" ALTER COLUMN "reason" TYPE "Reason_new" USING ("reason"::text::"Reason_new");
ALTER TYPE "Reason" RENAME TO "Reason_old";
ALTER TYPE "Reason_new" RENAME TO "Reason";
DROP TYPE "wallet"."Reason_old";
COMMIT;

-- CreateIndex
CREATE UNIQUE INDEX "Lock_ref_key" ON "Lock"("ref");
