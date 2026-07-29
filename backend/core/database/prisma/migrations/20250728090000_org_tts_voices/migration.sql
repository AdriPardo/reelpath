-- Organization TTS voice overrides (null = inherit platform .env).

ALTER TABLE "Organization" ADD COLUMN "edgeTtsVoice" TEXT;
ALTER TABLE "Organization" ADD COLUMN "elevenLabsVoiceId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "openaiTtsVoice" TEXT;
