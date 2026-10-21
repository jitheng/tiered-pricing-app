-- AlterTable: track per-level Shopify sync state so partial failures are visible and retryable
ALTER TABLE "TierLevel" ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- Existing levels that already have a Shopify discount are considered synced
UPDATE "TierLevel" SET "syncStatus" = 'SYNCED' WHERE "shopifyDiscountId" IS NOT NULL;
