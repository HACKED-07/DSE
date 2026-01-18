-- DropIndex
DROP INDEX "Ledger_ref_reason_key";

-- CreateIndex
CREATE INDEX "Ledger_ref_reason_idx" ON "Ledger"("ref", "reason");
