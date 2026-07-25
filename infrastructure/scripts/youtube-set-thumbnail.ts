#!/usr/bin/env tsx
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import 'dotenv/config';
import { prisma } from '@autotube/database';
import { uploadThumbnailToYouTubeApi } from '@autotube/youtube-publisher';

const execFileAsync = promisify(execFile);

async function extractThumbnailFromVideo(videoPath: string): Promise<string> {
  const thumbnailPath = videoPath.replace(/\.mp4$/, '-thumbnail.jpg');
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-ss', '1',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
    '-frames:v', '1', '-update', '1', '-q:v', '2',
    '-y', thumbnailPath,
  ]);
  return thumbnailPath;
}

async function main() {
  const videoId = process.argv[2];
  if (!videoId) {
    console.error('Uso: tsx infrastructure/scripts/youtube-set-thumbnail.ts <videoId>');
    process.exit(1);
  }

  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });

  if (!video.youtubeVideoId || video.youtubeVideoId.startsWith('mock_')) {
    console.error('El vídeo no está publicado en YouTube (ID real requerido)');
    process.exit(1);
  }

  let thumbnailPath = video.thumbnailPath;

  if (!thumbnailPath) {
    console.log('Generando miniatura desde el vídeo...');
    thumbnailPath = await extractThumbnailFromVideo(video.filePath);
    await prisma.video.update({
      where: { id: videoId },
      data: { thumbnailPath },
    });
    console.log(`Guardada en DB: ${thumbnailPath}`);
  } else {
    await fs.access(thumbnailPath);
    console.log(`Usando miniatura existente: ${thumbnailPath}`);
  }

  console.log(`Subiendo miniatura a YouTube (${video.youtubeVideoId})...`);
  await uploadThumbnailToYouTubeApi({
    youtubeVideoId: video.youtubeVideoId,
    filePath: path.resolve(thumbnailPath),
  });

  console.log(`Listo: https://youtube.com/watch?v=${video.youtubeVideoId}`);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
