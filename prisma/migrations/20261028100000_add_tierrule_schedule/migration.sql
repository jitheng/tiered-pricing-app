-- AlterTable: scheduled-discount date window on TierRule. Both nullable, so existing
-- rules are unaffected (startsAt null = active immediately, endsAt null = never expires).
ALTER TABLE "TierRule" ADD COLUMN "startsAt" TIMESTAMP(3);
ALTER TABLE "TierRule" ADD COLUMN "endsAt" TIMESTAMP(3);
