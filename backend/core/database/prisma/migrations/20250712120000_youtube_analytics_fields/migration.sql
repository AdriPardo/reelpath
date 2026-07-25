-- YouTube Analytics MVP: watch time and average view duration on snapshots
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN IF NOT EXISTS "watchTimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "AnalyticsSnapshot" ADD COLUMN IF NOT EXISTS "averageViewDurationSec" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "AnalyticsSnapshot_videoId_snapshotAt_idx" ON "AnalyticsSnapshot"("videoId", "snapshotAt");
