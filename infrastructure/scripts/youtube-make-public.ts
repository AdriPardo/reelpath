#!/usr/bin/env tsx
/** Pasa a públicos los vídeos ya subidos a YouTube (p. ej. estaban unlisted). */
import 'dotenv/config';
import { loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { setYouTubeVideoPrivacy, resolveYouTubeCredentialsForChannel } from '@autotube/youtube-publisher';

async function main() {
  const config = loadConfig();
  const privacy = config.YOUTUBE_PRIVACY_STATUS;

  const videos = await prisma.video.findMany({
    where: {
      youtubeVideoId: { not: null },
      NOT: { youtubeVideoId: { startsWith: 'mock_' } },
    },
    orderBy: { publishedAt: 'asc' },
  });

  if (videos.length === 0) {
    console.log('No hay vídeos publicados en YouTube.');
    return;
  }

  console.log(`Actualizando ${videos.length} vídeo(s) a visibilidad: ${privacy}\n`);

  for (const video of videos) {
    const id = video.youtubeVideoId!;
    try {
      const creds = await resolveYouTubeCredentialsForChannel(video.channelId);
      if (!creds) {
        console.error(`✗ ${video.title.slice(0, 50)}: sin credenciales YouTube para el canal`);
        continue;
      }
      await setYouTubeVideoPrivacy(id, privacy, creds);
      console.log(`✓ ${video.title.slice(0, 50)} — https://youtube.com/watch?v=${id}`);
    } catch (err) {
      console.error(`✗ ${video.title.slice(0, 50)}:`, err instanceof Error ? err.message : err);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
