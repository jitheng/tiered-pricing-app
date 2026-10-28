-- AlterTable: add an updatedAt audit field to TierLevel (auto-maintained by Prisma @updatedAt).
-- The table already has rows, so backfill them with the current timestamp, then drop the DB
-- default so the final column matches the schema (NOT NULL, app-managed) exactly like
-- TierRule.updatedAt.
ALTER TABLE "TierLevel" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TierLevel" ALTER COLUMN "updatedAt" DROP DEFAULT;
