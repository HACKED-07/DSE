-- Align stored user IDs with the application schema.
-- The app uses string user IDs (for example Better Auth/Prisma IDs),
-- but older wallet tables were created with INTEGER columns.
ALTER TABLE "wallet"."Ledger"
ALTER COLUMN "userId" TYPE TEXT USING "userId"::TEXT;

ALTER TABLE "wallet"."Lock"
ALTER COLUMN "userId" TYPE TEXT USING "userId"::TEXT;
