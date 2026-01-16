/*
  Warnings:

  - A unique constraint covering the columns `[ref,reason]` on the table `Ledger` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Ledger_ref_reason_key" ON "Ledger"("ref", "reason");
