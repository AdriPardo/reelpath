import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath } from '@autotube/config';
import { prisma } from '@autotube/database';
import { enqueuePipelineStep } from '@autotube/job-queue';
import {
  deleteYouTubeVideoApi,
  resolveYouTubeCredentialsForChannel,
} from '@autotube/youtube-publisher';

/**
 * Regenera TTS + render de un vídeo (p.ej. salió mudo) y vuelve a subir a YouTube.
 * Borra audios de escena y el final.mp4; encola generate_media → render → publish (reemplazo).
 */
export async function repairVideoAudioAndRepublish(videoId: string): Promise<{
  videoId: string;
  pipelineRunId: string;
  previousYoutubeVideoId: string | null;
  message: string;
}> {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) throw new Error('Video not found');

  const pipelineDir = getStoragePath('pipelines', video.pipelineRunId);
  const videoDir = getStoragePath('videos', video.pipelineRunId);

  // Borrar audios (y subtítulos ligados a duración TTS) para forzar regeneración.
  const entries = await fs.readdir(pipelineDir).catch(() => [] as string[]);
  for (const name of entries) {
    if (
      /-audio\.mp3$/i.test(name) ||
      /\.ass$/i.test(name) ||
      /\.srt$/i.test(name) ||
      name === 'subtitles.srt'
    ) {
      await fs.unlink(path.join(pipelineDir, name)).catch(() => undefined);
    }
  }

  await prisma.mediaAsset.deleteMany({
    where: {
      pipelineRunId: video.pipelineRunId,
      type: { in: ['audio', 'subtitle'] },
    },
  });

  // Forzar re-render del long.
  for (const p of [video.filePath, path.join(videoDir, 'final.mp4')]) {
    if (p) await fs.unlink(p).catch(() => undefined);
  }

  const previousYoutubeVideoId = video.youtubeVideoId;
  const run = await prisma.pipelineRun.findUniqueOrThrow({ where: { id: video.pipelineRunId } });
  const metadata = {
    ...((run.metadata as Record<string, unknown> | null) ?? {}),
    repairAudioRepublish: true,
    previousYoutubeVideoId,
  };

  await prisma.pipelineRun.update({
    where: { id: video.pipelineRunId },
    data: {
      status: 'generating_media',
      currentStep: 'generate_media',
      error: null,
      completedAt: null,
      metadata,
    },
  });

  await prisma.video.update({
    where: { id: video.id },
    data: {
      filePath: '',
      // Mantener youtubeVideoId hasta el publish de reemplazo (worker lo limpia).
      reviewStatus: video.reviewStatus === 'pending' ? 'pending' : 'approved',
    },
  });

  await enqueuePipelineStep(
    { pipelineRunId: video.pipelineRunId, channelId: video.channelId },
    'generate_media',
    { replace: true },
  );

  return {
    videoId: video.id,
    pipelineRunId: video.pipelineRunId,
    previousYoutubeVideoId,
    message:
      'Regenerando audio y render; al terminar se subirá de nuevo a YouTube y se borrará el vídeo mudo anterior.',
  };
}

/** Cancela/borra Shorts programados (YouTube + BD). */
export async function cancelScheduledShorts(videoId: string): Promise<{
  deleted: Array<{ clipId: string; youtubeVideoId: string | null }>;
  skipped: Array<{ clipId: string; reason: string }>;
}> {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) throw new Error('Video not found');

  const clips = await prisma.videoClip.findMany({
    where: {
      videoId,
      OR: [
        { publishStatus: 'scheduled' },
        {
          publishStatus: 'pending',
          scheduledPublishAt: { gt: new Date() },
        },
      ],
    },
  });

  const creds = await resolveYouTubeCredentialsForChannel(video.channelId);
  const deleted: Array<{ clipId: string; youtubeVideoId: string | null }> = [];
  const skipped: Array<{ clipId: string; reason: string }> = [];

  for (const clip of clips) {
    const ytId =
      clip.externalId && !clip.externalId.startsWith('mock_') ? clip.externalId : null;

    if (ytId) {
      if (!creds) {
        skipped.push({ clipId: clip.id, reason: 'YouTube no conectado; no se pudo borrar en YT' });
        continue;
      }
      try {
        await deleteYouTubeVideoApi(ytId, creds);
      } catch (err) {
        skipped.push({
          clipId: clip.id,
          reason: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }

    await prisma.videoClip.delete({ where: { id: clip.id } });
    deleted.push({ clipId: clip.id, youtubeVideoId: ytId });
  }

  return { deleted, skipped };
}

/** Borra un vídeo concreto de YouTube del canal (ops). */
export async function deleteChannelYouTubeVideo(
  channelId: string,
  youtubeVideoId: string,
): Promise<void> {
  if (!youtubeVideoId || youtubeVideoId.startsWith('mock_')) {
    throw new Error('ID de YouTube inválido');
  }
  const creds = await resolveYouTubeCredentialsForChannel(channelId);
  if (!creds) throw new Error('YouTube no conectado para este canal');
  await deleteYouTubeVideoApi(youtubeVideoId, creds);
}
