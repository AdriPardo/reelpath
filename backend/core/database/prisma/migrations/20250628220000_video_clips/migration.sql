-- TikTok / multi-platform clip parts
CREATE TABLE "VideoClip" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "partIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "platform" TEXT NOT NULL DEFAULT 'tiktok',
    "publishStatus" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoClip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoClip_videoId_partIndex_idx" ON "VideoClip"("videoId", "partIndex");
CREATE INDEX "VideoClip_pipelineRunId_idx" ON "VideoClip"("pipelineRunId");

ALTER TABLE "VideoClip" ADD CONSTRAINT "VideoClip_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
