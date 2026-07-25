-- Rename vertical clip source platform from TikTok-era 'tiktok' to neutral 'short_source'.
-- These clips are the source for YouTube Shorts uploads.
UPDATE "VideoClip" SET "platform" = 'short_source' WHERE "platform" = 'tiktok';

-- New default for future rows.
ALTER TABLE "VideoClip" ALTER COLUMN "platform" SET DEFAULT 'short_source';

-- Remove per-channel TikTok integration credentials (TikTok support dropped).
DELETE FROM "IntegrationCredential" WHERE "provider" = 'tiktok';
