-- CreateIndex
CREATE INDEX "PipelineRun_createdAt_idx" ON "PipelineRun"("createdAt");

-- CreateIndex
CREATE INDEX "PipelineRun_channelId_createdAt_idx" ON "PipelineRun"("channelId", "createdAt");
