import { parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { enqueuePipelineStep } from '@autotube/job-queue';
import type { PipelineJobPayload, PipelineStep } from '@autotube/shared';
import { PIPELINE_STEPS, expectedDedicatedOrMixedShortCount } from '@autotube/shared';
import { expectedShortsPartCount, getVideoDuration } from '@autotube/video-renderer';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'rejected', 'pending_review', 'cancelled']);

export function isPipelineInProgress(status: string): boolean {
  return !TERMINAL_STATUSES.has(status);
}

export function isPipelineStuck(
  run: { status: string; updatedAt: Date },
  staleMinutes = 10,
): boolean {
  if (TERMINAL_STATUSES.has(run.status)) return false;
  const ageMs = Date.now() - run.updatedAt.getTime();
  return ageMs > staleMinutes * 60 * 1000;
}

function inferResumePayload(
  run: { id: string; channelId: string; currentStep: string | null },
  config: ReturnType<typeof parseChannelConfig>,
): { step: PipelineStep; payload: PipelineJobPayload } {
  const step = (run.currentStep ?? 'generate_ideas') as PipelineStep;
  if (!PIPELINE_STEPS.includes(step)) {
    throw new Error(`Paso inválido para reanudar: ${step}`);
  }

  const payload: PipelineJobPayload = {
    pipelineRunId: run.id,
    channelId: run.channelId,
  };

  if ((step === 'split_shorts' || step === 'generate_short') && config.reviewRequired) {
    payload.splitOnly = true;
  }

  return { step, payload };
}

/** Vídeo ya aprobado/publicado en YouTube antes de terminar la generación de Shorts. */
async function isYouTubeAlreadyPublished(pipelineRunId: string): Promise<boolean> {
  const video = await prisma.video.findFirst({
    where: { pipelineRunId },
    select: { reviewStatus: true, youtubeVideoId: true },
  });
  if (!video) return false;
  return Boolean(video.youtubeVideoId) || video.reviewStatus === 'published';
}

async function finalizePreReviewClipStep(
  pipelineRunId: string,
): Promise<'pending_review' | 'completed'> {
  if (await isYouTubeAlreadyPublished(pipelineRunId)) {
    await prisma.pipelineRun.update({
      where: { id: pipelineRunId },
      data: {
        status: 'completed',
        currentStep: 'publish',
        error: null,
        completedAt: new Date(),
      },
    });
    return 'completed';
  }

  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      status: 'pending_review',
      currentStep: 'await_review',
      error: null,
    },
  });
  return 'pending_review';
}

/** Si la generación de clips verticales pre-review ya terminó, finaliza sin repetir. */
async function tryFinalizePreReviewClipStep(
  pipelineRunId: string,
  config: ReturnType<typeof parseChannelConfig>,
): Promise<boolean> {
  const needsSplit = config.publishYoutubeShorts === true && config.videoFormat === 'long';
  if (!config.reviewRequired || !needsSplit) return false;

  const video = await prisma.video.findFirst({ where: { pipelineRunId } });
  if (!video?.filePath) return false;

  const duration = await getVideoDuration(video.filePath);
  if (duration <= 0) return false;

  const expectedParts =
    config.shortsMode === 'dedicated' || config.shortsMode === 'mixed'
      ? expectedDedicatedOrMixedShortCount(config)
      : expectedShortsPartCount(duration, config.shortsClipMaxSec);
  const clipCount = await prisma.videoClip.count({
    where: { videoId: video.id, platform: 'short_source' },
  });

  if (clipCount < expectedParts) return false;

  await finalizePreReviewClipStep(pipelineRunId);
  return true;
}

export async function recoverPipelineRun(
  pipelineRunId: string,
  options?: { force?: boolean; staleMinutes?: number },
) {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    include: { channel: true },
  });
  if (!run) throw new Error('Pipeline run not found');

  if (run.status === 'cancelled') {
    throw new Error('No se puede reanudar un pipeline cancelado');
  }

  const staleMinutes = options?.staleMinutes ?? 10;
  if (!options?.force && !isPipelineStuck(run, staleMinutes)) {
    throw new Error(
      `Pipeline no parece atascado (estado=${run.status}, actualizado hace menos de ${staleMinutes} min)`,
    );
  }

  const config = parseChannelConfig(run.channel.config);
  const { step, payload } = inferResumePayload(run, config);

  if (run.status === 'pending_review' || step === 'await_review') {
    if (await isYouTubeAlreadyPublished(pipelineRunId)) {
      await finalizePreReviewClipStep(pipelineRunId);
      return {
        id: run.id,
        step: 'publish',
        jobId: '',
        status: 'completed',
        message: 'Vídeo ya en YouTube; Shorts listos',
      };
    }
    return {
      id: run.id,
      step: 'await_review',
      jobId: '',
      status: 'pending_review',
      message: 'Pipeline ya espera revisión humana (Shorts listos)',
    };
  }

  if (
    (step === 'split_shorts' || step === 'generate_short') &&
    (await tryFinalizePreReviewClipStep(pipelineRunId, config))
  ) {
    const finalStatus = await isYouTubeAlreadyPublished(pipelineRunId) ? 'completed' : 'pending_review';
    return {
      id: run.id,
      step: finalStatus === 'completed' ? 'publish' : 'await_review',
      jobId: '',
      status: finalStatus,
      message:
        finalStatus === 'completed'
          ? 'Shorts generados; vídeo ya en YouTube'
          : 'Shorts ya generados; pipeline en pending_review',
    };
  }

  await prisma.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: run.status === 'failed' ? 'scheduled' : run.status,
      error: null,
      completedAt: null,
    },
  });

  const job = await enqueuePipelineStep(payload, step, { replace: true });

  return {
    id: run.id,
    step,
    jobId: job.id,
    status: run.status,
    message: `Pipeline reencolado en paso ${step}`,
  };
}

export async function listStuckPipelines(staleMinutes = 10) {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);
  const runs = await prisma.pipelineRun.findMany({
    where: {
      status: { notIn: [...TERMINAL_STATUSES] },
      updatedAt: { lt: cutoff },
    },
    orderBy: { updatedAt: 'asc' },
    take: 100,
    include: {
      channel: { select: { name: true } },
      videos: { select: { title: true }, take: 1 },
    },
  });

  return runs.map((r) => ({
    id: r.id,
    channelId: r.channelId,
    status: r.status,
    currentStep: r.currentStep,
    updatedAt: r.updatedAt,
    channel: r.channel?.name,
    topic:
      (r.metadata as { forcedTopic?: string } | null)?.forcedTopic ??
      r.videos[0]?.title ??
      null,
  }));
}

export async function recoverAllStuckPipelines(
  staleMinutes = 10,
  force = false,
  channelIds?: string[] | null,
) {
  let stuck = await listStuckPipelines(staleMinutes);
  if (channelIds) {
    stuck = stuck.filter((s) => channelIds.includes(s.channelId));
  }
  const results: Array<{ id: string; ok: boolean; message: string }> = [];

  for (const row of stuck) {
    try {
      const res = await recoverPipelineRun(row.id, { force, staleMinutes });
      results.push({ id: row.id, ok: true, message: res.message });
    } catch (err) {
      results.push({
        id: row.id,
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { recovered: results.filter((r) => r.ok).length, total: stuck.length, results };
}
