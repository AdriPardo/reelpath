import { Router, type Response } from 'express';
import { z } from 'zod';
import { syncVideoAnalytics, getVideoYouTubeAnalytics } from '@autotube/analytics';
import { parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { enqueuePipelineStep } from '@autotube/job-queue';
import { parseScheduledPublishAt } from '@autotube/shared';
import { generateYouTubeThumbnail } from '@autotube/video-renderer';
import { streamVideoFile } from '../lib/video-file.js';
import { deletePipelineRunCompletely, deleteVideoLocalFilesOnly } from '../lib/pipeline-cleanup.js';
import { resolveChannelAutoPublishAt } from '../lib/publication-plan.js';
import { assertOrgCanPublish, PlanLimitError, planLimitErrorBody } from '../lib/plan-limits.js';
import { queueVideoYouTubePublish, retryVideoYouTubePublish, retryVideoYouTubeShorts } from '../lib/video-publish.js';
import { cancelScheduledShorts, repairVideoAudioAndRepublish } from '../lib/video-repair.js';
import {
  deleteSceneAssets,
  enqueueSceneRerender,
  loadScriptVariant,
} from '../lib/script-editor.js';
import { attachVisualSummaries, attachVisualSummary } from '../lib/visual-summary.js';
import { assertChannelInOrg, assertVideoInOrg } from '../lib/tenant.js';
import { authMiddleware, orgChannelIds, orgScope, requireAdmin } from '../middleware/auth.js';
import { paginatedResponse, parsePagination } from '../lib/pagination.js';

export const videosRouter = Router();

videosRouter.use(authMiddleware);

type VideoAccess = 'allowed' | 'not_found' | 'forbidden';

async function checkVideoAccess(videoId: string, orgId: string | undefined): Promise<VideoAccess> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true },
  });
  if (!video) return 'not_found';
  if (!orgId) return 'forbidden';
  return (await assertVideoInOrg(videoId, orgId)) ? 'allowed' : 'forbidden';
}

function rejectVideoAccess(res: Response, access: Exclude<VideoAccess, 'allowed'>): void {
  if (access === 'forbidden') {
    res.status(403).json({ error: 'No tienes acceso a este vídeo' });
    return;
  }
  res.status(404).json({ error: 'Vídeo no encontrado' });
}

async function respondRetryYouTubePublish(
  videoId: string,
  orgId: string | undefined,
  res: Response,
): Promise<void> {
  try {
    if (orgId) await assertOrgCanPublish(orgId);
    const result = await retryVideoYouTubePublish(videoId);
    const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
    res.json({ ...video, ...result });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      res.status(err.statusCode).json(planLimitErrorBody(err));
      return;
    }
    const message = err instanceof Error ? err.message : 'No se pudo reintentar la publicación';
    const status =
      message === 'Video not found'
        ? 404
        : message.includes('rechazado') ||
            message.includes('publicado') ||
            message.includes('Aprueba')
          ? 400
          : 500;
    res.status(status).json({ error: message });
  }
}

const approveVideoSchema = z.object({
  scheduledPublishAt: z.string().min(1).optional(),
});

const updateVideoSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(30).optional(),
});

const rescheduleVideoSchema = z.object({
  scheduledPublishAt: z.string().min(1),
});

const ARCHIVED_REVIEW_STATUSES = ['cancelled', 'rejected'] as const;

function orgChannelWhere(orgChannelIdList: string[] | null) {
  // null = sin org en sesión → ningún canal (fail-closed)
  if (orgChannelIdList === null || orgChannelIdList.length === 0) {
    return { channelId: { in: [] as string[] } };
  }
  return { channelId: { in: orgChannelIdList } };
}

videosRouter.get('/', async (req, res) => {
  const { channelId, reviewStatus, q, includeArchived, upcoming, sort } = req.query;
  const search = typeof q === 'string' && q.trim() ? q.trim() : undefined;
  const orgId = orgScope(req);
  const orgChannelIdList = await orgChannelIds(req);
  const showArchived = includeArchived === 'true';
  const onlyUpcoming = upcoming === 'true' || upcoming === '1';
  const status = reviewStatus ? String(reviewStatus) : undefined;

  if (channelId && orgId && !(await assertChannelInOrg(String(channelId), orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  // YouTube ya publicó tras publishAt vencido; sincroniza reviewStatus en cualquier listado.
  const { reconcileOverdueYoutubeScheduledVideos } = await import(
    '../lib/video-schedule-reconcile.js'
  );
  await reconcileOverdueYoutubeScheduledVideos(channelId ? String(channelId) : undefined);

  const pagination = parsePagination(req.query as Record<string, unknown>);

  const where = {
    ...orgChannelWhere(orgChannelIdList),
    ...(channelId ? { channelId: String(channelId) } : {}),
    ...(status
      ? { reviewStatus: status }
      : showArchived
        ? {}
        : { reviewStatus: { notIn: [...ARCHIVED_REVIEW_STATUSES] } }),
    ...(onlyUpcoming
      ? {
          reviewStatus: status ?? 'scheduled',
          scheduledPublishAt: { gte: new Date() },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const sortKey = typeof sort === 'string' ? sort : undefined;
  const orderBy =
    sortKey === 'scheduledPublishAt' || onlyUpcoming || status === 'scheduled'
      ? { scheduledPublishAt: 'asc' as const }
      : sortKey === 'createdAt_asc'
        ? { createdAt: 'asc' as const }
        : { createdAt: 'desc' as const };

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        pipelineRun: { select: { status: true, currentStep: true, error: true } },
        _count: { select: { clips: { where: { platform: 'short_source' } } } },
      },
    }),
    prisma.video.count({ where }),
  ]);

  const channelIds = [...new Set(videos.map((v) => v.channelId))];
  const channels = await prisma.channel.findMany({
    where: { id: { in: channelIds } },
    select: { id: true, name: true, slug: true, config: true },
  });
  const channelMap = new Map(
    channels.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        slug: c.slug,
        timezone: parseChannelConfig(c.config).timezone,
      },
    ]),
  );

  const mapped = await attachVisualSummaries(
    videos.map(({ _count, ...v }) => ({
      ...v,
      channel: channelMap.get(v.channelId) ?? null,
      clipCount: _count.clips,
    })),
  );

  return res.json(paginatedResponse(mapped, total, pagination));
});

videosRouter.get('/:id/thumbnail', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video?.thumbnailPath) return res.status(404).json({ error: 'Thumbnail not found' });

  streamVideoFile(video.thumbnailPath, res);
});

videosRouter.get('/:id/clips/:clipId/thumbnail', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const clip = await prisma.videoClip.findFirst({
    where: { id: req.params.clipId, videoId: req.params.id },
  });
  if (!clip?.thumbnailPath) return res.status(404).json({ error: 'Thumbnail not found' });

  streamVideoFile(clip.thumbnailPath, res);
});

videosRouter.get('/:id/clips', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const video = await prisma.video.findUnique({
    where: { id: req.params.id },
    select: { channelId: true },
  });
  if (!video) return res.status(404).json({ error: 'Video not found' });

  const { reconcileOverdueYoutubeScheduledVideos } = await import(
    '../lib/video-schedule-reconcile.js'
  );
  await reconcileOverdueYoutubeScheduledVideos(video.channelId);

  const clips = await prisma.videoClip.findMany({
    where: { videoId: req.params.id },
    orderBy: { partIndex: 'asc' },
  });
  res.json(clips);
});

videosRouter.get('/:id/clips/:clipId/stream', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const clip = await prisma.videoClip.findFirst({
    where: { id: req.params.clipId, videoId: req.params.id },
  });
  if (!clip) return res.status(404).json({ error: 'Clip not found' });

  streamVideoFile(clip.filePath, res, req.headers.range);
});

videosRouter.post('/:id/clips/:clipId/mark-published', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const clip = await prisma.videoClip.findFirst({
    where: { id: req.params.clipId, videoId: req.params.id },
  });
  if (!clip) return res.status(404).json({ error: 'Clip not found' });

  const externalId =
    typeof req.body?.externalId === 'string' && req.body.externalId.trim()
      ? req.body.externalId.trim()
      : undefined;

  const updated = await prisma.videoClip.update({
    where: { id: clip.id },
    data: {
      publishStatus: 'published',
      publishedAt: new Date(),
      error: null,
      ...(externalId ? { externalId } : {}),
    },
  });

  res.json(updated);
});

videosRouter.get('/:id/stream', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (!video.filePath) {
    return res.status(404).json({ error: 'Archivo local no disponible' });
  }

  streamVideoFile(video.filePath, res, req.headers.range);
});

videosRouter.get('/:id', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }

  const channelRef = await prisma.video.findUnique({
    where: { id: req.params.id },
    select: { channelId: true },
  });
  if (!channelRef) return res.status(404).json({ error: 'Video not found' });

  const { reconcileOverdueYoutubeScheduledVideos } = await import(
    '../lib/video-schedule-reconcile.js'
  );
  await reconcileOverdueYoutubeScheduledVideos(channelRef.channelId);

  const video = await prisma.video.findUnique({
    where: { id: req.params.id },
    include: {
      pipelineRun: {
        select: {
          status: true,
          currentStep: true,
          error: true,
          metadata: true,
          ideas: true,
        },
      },
      analytics: { orderBy: { snapshotAt: 'desc' }, take: 10 },
      clips: { orderBy: { partIndex: 'asc' } },
    },
  });
  if (!video) return res.status(404).json({ error: 'Video not found' });

  const channel = await prisma.channel.findUnique({
    where: { id: video.channelId },
    select: { id: true, name: true, slug: true, config: true },
  });
  res.json(await attachVisualSummary({ ...video, channel }));
});

videosRouter.post('/:id/republish', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  await respondRetryYouTubePublish(req.params.id, orgScope(req), res);
});

videosRouter.post('/:id/retry-publish', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  await respondRetryYouTubePublish(req.params.id, orgScope(req), res);
});

videosRouter.post('/:id/republish-shorts', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  try {
    const orgId = orgScope(req);
    if (orgId) await assertOrgCanPublish(orgId);
    const result = await retryVideoYouTubeShorts(req.params.id);
    const video = await prisma.video.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json({ ...video, ...result });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      res.status(err.statusCode).json(planLimitErrorBody(err));
      return;
    }
    const message = err instanceof Error ? err.message : 'No se pudo republicar los Shorts';
    const status =
      message === 'Video not found'
        ? 404
        : message.includes('archivado') ||
            message.includes('Aprueba') ||
            message.includes('No hay Shorts') ||
            message.includes('ya están publicados')
          ? 400
          : 500;
    res.status(status).json({ error: message });
  }
});

videosRouter.post('/:id/approve', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }

  const body = approveVideoSchema.safeParse(req.body ?? {});
  if (!body.success) {
    return res.status(400).json({ error: 'Fecha de programación inválida' });
  }

  const existing = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Video not found' });
  if (existing.reviewStatus !== 'pending') {
    return res.status(400).json({ error: 'Solo se pueden aprobar vídeos pendientes de revisión' });
  }

  const orgId = orgScope(req);
  if (orgId) {
    try {
      await assertOrgCanPublish(orgId);
    } catch (err) {
      if (err instanceof PlanLimitError) {
        return res.status(err.statusCode).json(planLimitErrorBody(err));
      }
      throw err;
    }
  }

  const fromBody = parseScheduledPublishAt(body.data.scheduledPublishAt);
  if (body.data.scheduledPublishAt && !fromBody) {
    return res.status(400).json({ error: 'La fecha debe ser al menos 1 minuto en el futuro' });
  }

  const fromPersisted =
    !fromBody &&
    existing.scheduledPublishAt &&
    existing.scheduledPublishAt.getTime() > Date.now() + 60_000
      ? existing.scheduledPublishAt
      : null;

  const channel = await prisma.channel.findUnique({ where: { id: existing.channelId } });
  const config = parseChannelConfig(channel?.config);
  const scheduledPublishAt = await resolveChannelAutoPublishAt(
    existing.channelId,
    config,
    fromBody ?? fromPersisted,
    existing.id,
  );

  const result = await queueVideoYouTubePublish(existing, scheduledPublishAt);

  const video = await prisma.video.findUniqueOrThrow({ where: { id: existing.id } });
  res.json({ ...video, ...result });
});

videosRouter.post('/:id/reject', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video) return res.status(404).json({ error: 'Video not found' });

  if (video.reviewStatus === 'published') {
    return res.status(400).json({
      error: 'No se puede rechazar un vídeo ya publicado; usa eliminación manual si aplica',
    });
  }

  const { videoId } = await deletePipelineRunCompletely(video.pipelineRunId);

  res.json({
    deleted: true,
    id: videoId ?? video.id,
    pipelineRunId: video.pipelineRunId,
    message: 'Vídeo rechazado y eliminado por completo',
  });
});

videosRouter.patch('/:id', async (req, res) => {
  const body = updateVideoSchema.parse(req.body);
  if (Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  const existing = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Video not found' });
  const access = await checkVideoAccess(existing.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  if (existing.reviewStatus === 'published') {
    return res.status(400).json({ error: 'No se puede editar un vídeo ya publicado' });
  }

  const video = await prisma.video.update({
    where: { id: req.params.id },
    data: body,
  });
  res.json(video);
});

videosRouter.patch('/:id/schedule', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }

  const body = rescheduleVideoSchema.safeParse(req.body ?? {});
  if (!body.success) {
    return res.status(400).json({ error: 'Fecha de programación inválida' });
  }

  const existing = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Video not found' });
  if (existing.reviewStatus === 'published') {
    return res.status(400).json({ error: 'No se puede reprogramar un vídeo ya publicado' });
  }
  if (existing.reviewStatus === 'rejected' || existing.reviewStatus === 'cancelled') {
    return res.status(400).json({ error: 'No se puede reprogramar un vídeo archivado' });
  }

  const scheduledPublishAt = parseScheduledPublishAt(body.data.scheduledPublishAt);
  if (!scheduledPublishAt) {
    return res.status(400).json({ error: 'La fecha debe ser al menos 1 minuto en el futuro' });
  }

  // Ya en cola de YouTube con schedule: reencolar de forma segura.
  if (existing.reviewStatus === 'scheduled') {
    try {
      const orgId = orgScope(req);
      if (orgId) await assertOrgCanPublish(orgId);
      const result = await queueVideoYouTubePublish(existing, scheduledPublishAt);
      const video = await prisma.video.findUniqueOrThrow({ where: { id: existing.id } });
      return res.json({ ...video, ...result });
    } catch (err) {
      if (err instanceof PlanLimitError) {
        return res.status(err.statusCode).json(planLimitErrorBody(err));
      }
      throw err;
    }
  }

  // pending / approved: solo persiste en DB (no publica a YouTube).
  const video = await prisma.video.update({
    where: { id: existing.id },
    data: { scheduledPublishAt },
  });
  res.json({
    ...video,
    message: 'Fecha de publicación actualizada',
  });
});

videosRouter.post('/:id/regenerate-thumbnail', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const variantRaw = (req.body as unknown as { variant?: unknown })?.variant;
  const variant =
    variantRaw === 'A' || variantRaw === 'B' || variantRaw === 'C' || variantRaw === 'auto'
      ? (variantRaw as 'A' | 'B' | 'C' | 'auto')
      : 'auto';

  const video = await prisma.video.findUnique({
    where: { id: req.params.id },
    include: {
      pipelineRun: { include: { mediaAssets: { where: { type: 'image' }, take: 1 } } },
    },
  });
  if (!video) return res.status(404).json({ error: 'Video not found' });

  const isLandscape = video.aspectRatio === '16:9';
  const width = isLandscape ? 1920 : 1080;
  const height = isLandscape ? 1080 : 1920;
  const thumbnailPath = video.filePath.replace(/\.mp4$/, '-thumbnail.jpg');
  const firstImage = video.pipelineRun.mediaAssets[0]?.path ?? null;

  await generateYouTubeThumbnail({
    title: video.title,
    backgroundImagePath: firstImage,
    videoPath: video.filePath,
    outputPath: thumbnailPath,
    width,
    height,
    variant,
  });

  const updated = await prisma.video.update({
    where: { id: video.id },
    data: { thumbnailPath },
  });

  res.json({ id: updated.id, thumbnailPath, message: 'Miniatura regenerada' });
});

videosRouter.post('/:id/regenerate-shorts', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video) return res.status(404).json({ error: 'Video not found' });

  const channel = await prisma.channel.findUnique({ where: { id: video.channelId } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  const config = parseChannelConfig(channel.config);
  const step = config.shortsMode === 'dedicated' ? 'generate_short' : 'split_shorts';

  await enqueuePipelineStep(
    { pipelineRunId: video.pipelineRunId, channelId: video.channelId, splitOnly: true },
    step,
    { replace: true },
  );

  res.json({ id: video.id, message: 'Regenerando Shorts…', step });
});

videosRouter.post('/:id/regenerate-scene/:sceneIndex', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }

  const sceneIndex = Number(req.params.sceneIndex);
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
    return res.status(400).json({ error: 'Índice de escena inválido' });
  }

  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video) return res.status(404).json({ error: 'Vídeo no encontrado' });
  if (video.reviewStatus !== 'pending') {
    return res.status(400).json({ error: 'Solo se pueden regenerar escenas en vídeos pendientes de revisión' });
  }

  const { variant } = await loadScriptVariant(video.pipelineRunId);
  if (sceneIndex >= variant.scenes.length) {
    return res.status(400).json({ error: 'Escena no encontrada en el guion' });
  }

  await deleteSceneAssets(video.pipelineRunId, sceneIndex);
  await enqueueSceneRerender(video.pipelineRunId, video.channelId);

  res.json({
    id: video.id,
    sceneIndex,
    message: `Regenerando escena ${sceneIndex + 1}…`,
  });
});

videosRouter.get('/:id/youtube-analytics', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const data = await getVideoYouTubeAnalytics(req.params.id);
  res.json(data);
});

videosRouter.post('/:id/sync-analytics', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video) return res.status(404).json({ error: 'Video not found' });

  const result = await syncVideoAnalytics(video.id);
  res.json({
    id: video.id,
    ...result,
    metrics: result,
    message:
      result.source === 'mock'
        ? 'Analytics simulados (mock o sin ID YouTube real)'
        : 'Analytics sincronizados desde YouTube',
  });
});

videosRouter.post('/:id/delete-local-files', async (req, res) => {
  const access = await checkVideoAccess(req.params.id, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  const video = await prisma.video.findUnique({ where: { id: req.params.id } });
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (!video.filePath) {
    return res.status(400).json({ error: 'Los archivos locales ya fueron eliminados' });
  }

  const freedPaths = await deleteVideoLocalFilesOnly(video.id);
  res.json({
    id: video.id,
    message: 'Archivos locales eliminados; el registro y enlace YouTube se conservan',
    freedPaths,
  });
});

/** Regenera TTS+render y vuelve a subir el long a YouTube (borra el anterior). */
videosRouter.post('/:id/repair-audio', requireAdmin, async (req, res) => {
  const videoId = String(req.params.id);
  const access = await checkVideoAccess(videoId, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  try {
    const result = await repairVideoAudioAndRepublish(videoId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo reparar el audio';
    res.status(message === 'Video not found' ? 404 : 500).json({ error: message });
  }
});

/** Borra Shorts programados de YouTube + BD. */
videosRouter.post('/:id/cancel-scheduled-shorts', requireAdmin, async (req, res) => {
  const videoId = String(req.params.id);
  const access = await checkVideoAccess(videoId, orgScope(req));
  if (access !== 'allowed') {
    rejectVideoAccess(res, access);
    return;
  }
  try {
    const result = await cancelScheduledShorts(videoId);
    res.json({
      id: videoId,
      message: `Eliminados ${result.deleted.length} Shorts programados`,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudieron cancelar los Shorts';
    res.status(message === 'Video not found' ? 404 : 500).json({ error: message });
  }
});
