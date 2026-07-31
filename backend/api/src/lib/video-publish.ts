import { prisma } from '@autotube/database';
import { enqueuePipelineStep, removePipelineStepJob } from '@autotube/job-queue';

export interface QueueVideoPublishResult {
  reviewStatus: string;
  scheduledPublishAt: Date | null;
  message: string;
}

async function resetPublishPipelineRun(pipelineRunId: string): Promise<void> {
  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      status: 'publishing',
      currentStep: 'publish',
      error: null,
      completedAt: null,
    },
  });
}

export async function queueVideoYouTubePublish(
  video: { id: string; pipelineRunId: string; channelId: string },
  scheduledPublishAt: Date | null,
  options?: { replace?: boolean },
): Promise<QueueVideoPublishResult> {
  const isScheduled = scheduledPublishAt !== null && scheduledPublishAt.getTime() > Date.now();
  const replace = options?.replace ?? true;

  if (replace) {
    await removePipelineStepJob(video.pipelineRunId, 'publish');
  }

  await enqueuePipelineStep(
    {
      pipelineRunId: video.pipelineRunId,
      channelId: video.channelId,
      youtubeOnly: true,
    },
    'publish',
    { replace },
  );

  if (isScheduled) {
    await prisma.video.update({
      where: { id: video.id },
      data: { reviewStatus: 'scheduled', scheduledPublishAt },
    });
    await resetPublishPipelineRun(video.pipelineRunId);

    return {
      reviewStatus: 'scheduled',
      scheduledPublishAt,
      message: 'Subiendo a YouTube con publicación programada',
    };
  }

  await prisma.video.update({
    where: { id: video.id },
    data: { reviewStatus: 'approved', scheduledPublishAt: null },
  });
  await resetPublishPipelineRun(video.pipelineRunId);

  return {
    reviewStatus: 'approved',
    scheduledPublishAt: null,
    message: 'En cola para publicación en YouTube',
  };
}

export async function retryVideoYouTubePublish(videoId: string): Promise<QueueVideoPublishResult> {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    throw new Error('Video not found');
  }
  if (video.reviewStatus === 'rejected') {
    throw new Error('Video rechazado; no se puede republicar');
  }
  if (video.reviewStatus === 'published' && video.youtubeVideoId) {
    throw new Error('El vídeo ya está publicado en YouTube');
  }
  if (video.reviewStatus === 'pending') {
    throw new Error('Aprueba el vídeo antes de publicarlo en YouTube');
  }

  await removePipelineStepJob(video.pipelineRunId, 'publish');

  const scheduledPublishAt =
    video.reviewStatus === 'scheduled' ? video.scheduledPublishAt : null;

  if (video.reviewStatus !== 'scheduled') {
    await prisma.video.update({
      where: { id: video.id },
      data: { reviewStatus: 'approved' },
    });
  }

  await enqueuePipelineStep(
    {
      pipelineRunId: video.pipelineRunId,
      channelId: video.channelId,
      youtubeOnly: true,
    },
    'publish',
    { replace: true },
  );

  await resetPublishPipelineRun(video.pipelineRunId);

  const message =
    scheduledPublishAt && scheduledPublishAt.getTime() > Date.now()
      ? 'Reintentando subida a YouTube con publicación programada'
      : 'Reintentando publicación en YouTube';

  return {
    reviewStatus: video.reviewStatus === 'scheduled' ? 'scheduled' : 'approved',
    scheduledPublishAt,
    message,
  };
}

/** Reintenta solo Shorts fallidos/pendientes, respetando la programación de cada clip. */
export async function retryVideoYouTubeShorts(videoId: string): Promise<QueueVideoPublishResult> {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    throw new Error('Video not found');
  }
  if (video.reviewStatus === 'rejected' || video.reviewStatus === 'cancelled') {
    throw new Error('Vídeo archivado; no se pueden republicar Shorts');
  }
  if (video.reviewStatus === 'pending') {
    throw new Error('Aprueba el vídeo antes de publicar los Shorts');
  }

  const sourceCount = await prisma.videoClip.count({
    where: { videoId: video.id, platform: 'short_source' },
  });
  if (sourceCount === 0) {
    throw new Error('No hay Shorts generados para este vídeo');
  }

  const needsRetry = await prisma.videoClip.count({
    where: {
      videoId: video.id,
      platform: 'youtube_shorts',
      OR: [
        { publishStatus: 'failed' },
        { publishStatus: 'pending' },
        { externalId: { startsWith: 'mock_' } },
      ],
    },
  });
  // También si nunca se crearon filas youtube_shorts (solo short_source).
  const ytCount = await prisma.videoClip.count({
    where: { videoId: video.id, platform: 'youtube_shorts' },
  });
  if (needsRetry === 0 && ytCount > 0) {
    throw new Error('Todos los Shorts ya están publicados o programados');
  }

  await removePipelineStepJob(video.pipelineRunId, 'publish_youtube_shorts');
  await enqueuePipelineStep(
    {
      pipelineRunId: video.pipelineRunId,
      channelId: video.channelId,
      shortsOnly: true,
    },
    'publish_youtube_shorts',
    { replace: true },
  );

  await resetPublishPipelineRun(video.pipelineRunId);

  return {
    reviewStatus: video.reviewStatus,
    scheduledPublishAt: video.scheduledPublishAt,
    message: 'Reintentando publicación de Shorts (se respeta la programación de cada uno)',
  };
}
