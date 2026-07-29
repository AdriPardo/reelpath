-- Performance indexes for list/filter queries (videos, pipelines, scripts, channels).

CREATE INDEX IF NOT EXISTS "Channel_organizationId_isActive_idx" ON "Channel"("organizationId", "isActive");

CREATE INDEX IF NOT EXISTS "PipelineRun_status_updatedAt_idx" ON "PipelineRun"("status", "updatedAt");

CREATE INDEX IF NOT EXISTS "Script_pipelineRunId_idx" ON "Script"("pipelineRunId");

CREATE INDEX IF NOT EXISTS "Video_channelId_createdAt_idx" ON "Video"("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "Video_channelId_scheduledPublishAt_idx" ON "Video"("channelId", "scheduledPublishAt");
CREATE INDEX IF NOT EXISTS "Video_pipelineRunId_idx" ON "Video"("pipelineRunId");
CREATE INDEX IF NOT EXISTS "Video_createdAt_idx" ON "Video"("createdAt");
CREATE INDEX IF NOT EXISTS "Video_reviewStatus_createdAt_idx" ON "Video"("reviewStatus", "createdAt");
