-- Organization cost/quality knobs for AI images (channel > org > env hierarchy).

ALTER TABLE "Organization" ADD COLUMN "maxAiImagesPerVideo" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "openaiImageQuality" TEXT;
