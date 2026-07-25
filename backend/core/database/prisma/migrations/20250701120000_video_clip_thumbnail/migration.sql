-- VideoClip thumbnail (for DBs created before thumbnailPath was in schema)
ALTER TABLE "VideoClip" ADD COLUMN IF NOT EXISTS "thumbnailPath" TEXT;
