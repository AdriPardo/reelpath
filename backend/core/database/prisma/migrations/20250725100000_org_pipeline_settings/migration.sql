-- Organization-level pipeline preferences (LLM / TTS / AI images / scenes).
-- Platform .env remains the fallback when no org override applies.

ALTER TABLE "Organization" ADD COLUMN "llmProvider" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Organization" ADD COLUMN "ttsProvider" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Organization" ADD COLUMN "generateAiImages" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "maxScenesLong" INTEGER;
