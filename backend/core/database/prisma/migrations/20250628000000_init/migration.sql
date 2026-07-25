-- CreateSchema
CREATE TABLE IF NOT EXISTS "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "youtubeId" TEXT,
    "niche" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Channel_slug_key" ON "Channel"("slug");

CREATE TABLE IF NOT EXISTS "PipelineRun" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStep" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PipelineRun_channelId_status_idx" ON "PipelineRun"("channelId", "status");

CREATE TABLE IF NOT EXISTS "VideoIdea" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "trendAlignment" DOUBLE PRECISION NOT NULL,
    "viralScore" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "scoreBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoIdea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VideoIdea_pipelineRunId_viralScore_idx" ON "VideoIdea"("pipelineRunId", "viralScore");

CREATE TABLE IF NOT EXISTS "Script" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "selectedVariant" JSONB NOT NULL,
    "alternateVariant" JSONB,
    "hookVariantUsed" TEXT NOT NULL DEFAULT 'A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "sceneIndex" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MediaAsset_pipelineRunId_sceneIndex_idx" ON "MediaAsset"("pipelineRunId", "sceneIndex");

CREATE TABLE IF NOT EXISTS "Video" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "filePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "format" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "youtubeVideoId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Video_channelId_reviewStatus_idx" ON "Video"("channelId", "reviewStatus");

CREATE TABLE IF NOT EXISTS "PromptVersion" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "variables" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_type_version_key" ON "PromptVersion"("type", "version");
CREATE INDEX IF NOT EXISTS "PromptVersion_type_isActive_idx" ON "PromptVersion"("type", "isActive");

CREATE TABLE IF NOT EXISTS "PromptVariant" (
    "id" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "templateOverride" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromptVariant_promptVersionId_variantKey_key" ON "PromptVariant"("promptVersionId", "variantKey");

CREATE TABLE IF NOT EXISTS "PromptBinding" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "promptType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromptBinding_channelId_promptType_key" ON "PromptBinding"("channelId", "promptType");

CREATE TABLE IF NOT EXISTS "PromptAbResult" (
    "id" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "pipelineRunId" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromptAbResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "videoId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retention" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,
    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsSnapshot_channelId_snapshotAt_idx" ON "AnalyticsSnapshot"("channelId", "snapshotAt");

CREATE TABLE IF NOT EXISTS "TrendSnapshot" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'simulated',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrendSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrendSnapshot_niche_fetchedAt_idx" ON "TrendSnapshot"("niche", "fetchedAt");

CREATE TABLE IF NOT EXISTS "VideoTemplateRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoTemplateRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoIdea" ADD CONSTRAINT "VideoIdea_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Script" ADD CONSTRAINT "Script_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Video" ADD CONSTRAINT "Video_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptVariant" ADD CONSTRAINT "PromptVariant_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptBinding" ADD CONSTRAINT "PromptBinding_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptBinding" ADD CONSTRAINT "PromptBinding_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptAbResult" ADD CONSTRAINT "PromptAbResult_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptAbResult" ADD CONSTRAINT "PromptAbResult_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "PromptVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
