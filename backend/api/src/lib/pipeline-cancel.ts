import { prisma } from '@autotube/database';
import { cancelPipelineJobsForRun } from '@autotube/job-queue';

const CANCELLABLE_VIDEO_REVIEW = new Set(['pending', 'approved', 'scheduled']);

/** Pipeline cancelable si no está ya cancelado y el vídeo no se publicó en YouTube. */
export function isPipelineCancellable(
  status: string,
  video?: { reviewStatus: string; youtubeVideoId?: string | null } | null,
): boolean {
  if (status === 'cancelled') return false;
  if (video?.youtubeVideoId || video?.reviewStatus === 'published') return false;
  if (status === 'failed') return false;
  // Latente: pipeline marcado completed pero publicación diferida pendiente en cola.
  if (status === 'completed') return video?.reviewStatus === 'scheduled';
  return true;
}

export async function cancelPipelineRun(pipelineRunId: string): Promise<{
  id: string;
  status: 'cancelled';
  alreadyCancelled: boolean;
  jobsRemoved: number;
  jobsActive: number;
  message: string;
}> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    include: {
      videos: {
        select: { id: true, reviewStatus: true, youtubeVideoId: true },
        take: 1,
      },
    },
  });
  if (!run) throw new Error('Pipeline run not found');

  const video = run.videos[0] ?? null;

  if (run.status === 'cancelled') {
    const jobs = await cancelPipelineJobsForRun(pipelineRunId);
    return {
      id: run.id,
      status: 'cancelled',
      alreadyCancelled: true,
      jobsRemoved: jobs.removed,
      jobsActive: jobs.active,
      message: 'Pipeline ya estaba cancelado',
    };
  }

  if (!isPipelineCancellable(run.status, video)) {
    throw new Error('Este pipeline no se puede cancelar (ya publicado o finalizado)');
  }

  const jobs = await cancelPipelineJobsForRun(pipelineRunId);

  if (video && !video.youtubeVideoId && video.reviewStatus !== 'published') {
    if (CANCELLABLE_VIDEO_REVIEW.has(video.reviewStatus)) {
      await prisma.video.update({
        where: { id: video.id },
        data: { reviewStatus: 'cancelled', scheduledPublishAt: null },
      });
    }
    await prisma.videoClip.updateMany({
      where: { videoId: video.id, publishStatus: 'pending' },
      data: { publishStatus: 'cancelled', scheduledPublishAt: null },
    });
  }

  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      status: 'cancelled',
      error: null,
      completedAt: new Date(),
    },
  });

  const activeNote =
    jobs.active > 0
      ? ` (${jobs.active} job(s) activo(s) terminarán sin reencolar)`
      : '';

  return {
    id: pipelineRunId,
    status: 'cancelled',
    alreadyCancelled: false,
    jobsRemoved: jobs.removed,
    jobsActive: jobs.active,
    message: `Pipeline cancelado; ${jobs.removed} job(s) eliminados de la cola${activeNote}`,
  };
}
