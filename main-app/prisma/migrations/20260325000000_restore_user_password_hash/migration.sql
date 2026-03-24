-- Restore the credentials column expected by the application and generated Prisma client.
ALTER TABLE "api"."User"
ADD COLUMN "passwordHash" TEXT;
