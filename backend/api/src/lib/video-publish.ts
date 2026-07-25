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
