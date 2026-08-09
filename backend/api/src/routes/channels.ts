import { Router } from 'express';
import { z } from 'zod';
import {
  getChannelAnalyticsInsights,
  getChannelYouTubeAnalytics,
  syncChannelYouTubeAnalytics,
} from '@autotube/analytics';
import { channelConfigSchema, decryptCredentialPayload, loadConfig, parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import {
  buildCredentialFromEnv,
  deleteChannelCredential,
  getChannelIntegrations,
  getIntegrationsSummaryForChannels,
  type IntegrationProvider,
  type YouTubeCredentialData,
  upsertChannelCredential,
} from '../lib/channel-integrations.js';
import {
  buildYouTubeAuthUrl,
  hasYouTubeOAuthApp,
  signYouTubeOAuthState,
} from '../lib/youtube-oauth.js';
import { deleteChannelWithCleanup } from '../lib/channel-deletion.js';
import { validateChannelCompliance } from '../lib/channel-compliance.js';
import {
  assertOrgCanTriggerPipeline,
  PlanLimitError,
  planLimitErrorBody,
  resolveOrgPlanLimits,
} from '../lib/plan-limits.js';
import { handleLongVideoUpload } from '../lib/upload-long.js';
import { assertChannelInOrg } from '../lib/tenant.js';
import { authMiddleware, orgScope } from '../middleware/auth.js';
import { paginatedResponse, parsePagination } from '../lib/pagination.js';
import multer from 'multer';
import { bgmRouter } from './bgm.js';

/** Estados terminales / espera de review — el resto cuenta como generación activa. */
const PIPELINE_IDLE_STATUSES = [
  'completed',
  'failed',
  'rejected',
  'pending_review',
  'cancelled',
] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const integrationProviders = ['youtube'] as const;

const patchIntegrationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('link_from_env') }),
  z.object({ action: z.literal('disconnect') }),
  z.object({
    action: z.literal('connect'),
    credentials: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        refreshToken: z.string().optional(),
      })
      .optional(),
    privacyStatus: z.enum(['private', 'unlisted', 'public']).optional(),
  }),
  z.object({
    action: z.literal('update'),
    privacyStatus: z.enum(['private', 'unlisted', 'public']).optional(),
  }),
]);

export const channelsRouter = Router();

channelsRouter.use(authMiddleware);
channelsRouter.use('/:id/bgm', bgmRouter);

channelsRouter.get('/', async (req, res) => {
  const orgId = orgScope(req);
  const pagination = parsePagination(req.query as Record<string, unknown>);

  // Fail-closed: sin org no se listan canales de otros tenants
  const where = orgId ? { organizationId: orgId } : { organizationId: '__none__' };

  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.explicit ? pagination.skip : 0,
      take: pagination.explicit ? pagination.limit : 200,
      select: {
        id: true,
        name: true,
        slug: true,
        niche: true,
        isActive: true,
        youtubeId: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
      },
    }),
    prisma.channel.count({ where }),
  ]);

  const channelIds = channels.map((c) => c.id);
  const [summaries, pendingCounts, activeCounts, lastRuns] = await Promise.all([
    getIntegrationsSummaryForChannels(channelIds),
    channelIds.length === 0
      ? Promise.resolve([] as { channelId: string; _count: { _all: number } }[])
      : prisma.video.groupBy({
          by: ['channelId'],
          where: { channelId: { in: channelIds }, reviewStatus: 'pending' },
          _count: { _all: true },
        }),
    channelIds.length === 0
      ? Promise.resolve([] as { channelId: string; _count: { _all: number } }[])
      : prisma.pipelineRun.groupBy({
          by: ['channelId'],
          where: {
            channelId: { in: channelIds },
            status: { notIn: [...PIPELINE_IDLE_STATUSES] },
          },
          _count: { _all: true },
        }),
    channelIds.length === 0
      ? Promise.resolve([] as { channelId: string; createdAt: Date }[])
      : prisma.pipelineRun.findMany({
          where: { channelId: { in: channelIds } },
          orderBy: { createdAt: 'desc' },
          distinct: ['channelId'],
          select: { channelId: true, createdAt: true },
        }),
  ]);

  const pendingMap = new Map(pendingCounts.map((r) => [r.channelId, r._count._all]));
  const activeMap = new Map(activeCounts.map((r) => [r.channelId, r._count._all]));
  const lastRunMap = new Map(lastRuns.map((r) => [r.channelId, r.createdAt]));

  const mapped = channels.map((ch) => ({
    ...ch,
    integrations: summaries[ch.id] ?? {
      youtube: { connected: false, tokenOk: false, source: 'none' as const },
    },
    stats: {
      pendingReview: pendingMap.get(ch.id) ?? 0,
      activeGenerations: activeMap.get(ch.id) ?? 0,
      lastGenerationAt: lastRunMap.get(ch.id)?.toISOString() ?? null,
    },
  }));

  if (pagination.explicit) {
    return res.json(paginatedResponse(mapped, total, pagination));
  }

  res.json(mapped);
});

channelsRouter.get('/:id/integrations/youtube/connect', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Se requiere autenticación para conectar YouTube' });
  }

  if (!hasYouTubeOAuthApp()) {
    return res.status(503).json({
      error: 'YouTube no está configurado en la plataforma. Contacta al administrador.',
    });
  }

  const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!(await assertChannelInOrg(channel.id, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const state = await signYouTubeOAuthState({
    channelId: channel.id,
    organizationId: orgId,
  });
  const url = buildYouTubeAuthUrl(state);

  if (req.query.redirect === 'true') {
    return res.redirect(url);
  }

  res.json({ url });
});

channelsRouter.get('/:id/integrations', async (req, res) => {
  const orgId = orgScope(req);
  const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (orgId && !(await assertChannelInOrg(channel.id, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const integrations = await getChannelIntegrations(channel.id);
  res.json(integrations);
});

channelsRouter.patch('/:id/integrations/:provider', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Se requiere autenticación para gestionar integraciones' });
  }

  const provider = req.params.provider as IntegrationProvider;
  if (!integrationProviders.includes(provider)) {
    return res.status(400).json({ error: 'Proveedor no válido' });
  }

  const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (!(await assertChannelInOrg(channel.id, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const body = patchIntegrationSchema.parse(req.body);

  if (body.action === 'disconnect') {
    await deleteChannelCredential(channel.id, provider);
    const integrations = await getChannelIntegrations(channel.id);
    return res.json(integrations);
  }

  if (body.action === 'link_from_env') {
    try {
      const data = buildCredentialFromEnv(provider);
      await upsertChannelCredential(orgId, channel.id, provider, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: message });
    }
    const integrations = await getChannelIntegrations(channel.id);
    return res.json(integrations);
  }

  if (body.action === 'connect') {
    const creds = body.credentials;
    const config = loadConfig();
    const { resolvePlatformYouTubeOAuthAppSync } = await import('@autotube/config');
    const oauthApp = resolvePlatformYouTubeOAuthAppSync();
    const refreshToken = creds?.refreshToken;
    const clientId = creds?.clientId ?? oauthApp?.clientId;
    const clientSecret = creds?.clientSecret ?? oauthApp?.clientSecret;

    if (!refreshToken || !clientId || !clientSecret) {
      return res.status(400).json({
        error: 'YouTube requiere autorización OAuth o refreshToken (desarrollo)',
      });
    }
    const data: YouTubeCredentialData = {
      clientId,
      clientSecret,
      refreshToken,
      privacyStatus: body.privacyStatus ?? 'private',
      linkedFromEnv: false,
    };
    await upsertChannelCredential(orgId, channel.id, provider, data);
    const integrations = await getChannelIntegrations(channel.id);
    return res.json(integrations);
  }

  if (body.action === 'update') {
    const existing = await prisma.integrationCredential.findFirst({
      where: { channelId: channel.id, provider },
    });
    if (!existing) {
      return res.status(404).json({ error: 'No hay credenciales guardadas para este canal' });
    }
    const current =
      (decryptCredentialPayload(existing.data) as YouTubeCredentialData | null) ?? {};
    const merged: YouTubeCredentialData = {
      ...current,
      ...(body.privacyStatus ? { privacyStatus: body.privacyStatus } : {}),
    };
    await upsertChannelCredential(orgId, channel.id, provider, merged);
    const integrations = await getChannelIntegrations(channel.id);
    return res.json(integrations);
  }

  return res.status(400).json({ error: 'Acción no válida' });
});

channelsRouter.get('/:id/videos', async (req, res) => {
  const orgId = orgScope(req);
  const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (orgId && channel.organizationId !== orgId) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const { reviewStatus, q } = req.query;
  const search = typeof q === 'string' && q.trim() ? q.trim() : undefined;
  const showArchived = req.query.includeArchived === 'true';
  const pagination = parsePagination(req.query as Record<string, unknown>);

  const where = {
    channelId: channel.id,
    ...(reviewStatus
      ? { reviewStatus: String(reviewStatus) }
      : showArchived
        ? {}
        : { reviewStatus: { notIn: ['cancelled', 'rejected'] } }),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        pipelineRun: { select: { status: true, currentStep: true, error: true } },
        _count: { select: { clips: { where: { platform: 'short_source' } } } },
      },
    }),
    prisma.video.count({ where }),
  ]);

  const mapped = videos.map(({ _count, ...v }) => ({
    ...v,
    channel: { id: channel.id, name: channel.name, slug: channel.slug },
    clipCount: _count.clips,
  }));

  return res.json(paginatedResponse(mapped, total, pagination));
});

channelsRouter.get('/:id/publication-plan', async (req, res) => {
  const orgId = orgScope(req);
  const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (orgId && channel.organizationId !== orgId) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const { getChannelPublicationPlan } = await import('../lib/publication-plan.js');
  const plan = await getChannelPublicationPlan(channel.id);
  res.json(plan);
});

channelsRouter.post('/:id/publication-plan/apply', async (req, res) => {
  const orgId = orgScope(req);
  const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (orgId && channel.organizationId !== orgId) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  try {
    const { applyChannelPublicationPlan, getChannelPublicationPlan } = await import(
      '../lib/publication-plan.js'
    );
    const result = await applyChannelPublicationPlan(channel.id);
    const plan = await getChannelPublicationPlan(channel.id);
    res.json({ ...result, plan });
  } catch (err) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : 500;
    const message = err instanceof Error ? err.message : 'No se pudo aplicar el plan';
    res.status(statusCode).json({ error: message });
  }
});

channelsRouter.post('/:id/upload-long', upload.single('video'), async (req, res) => {
  const channelId = String(req.params.id);
  const orgId = orgScope(req);
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
  if (orgId && channel.organizationId !== orgId) {
    return res.status(404).json({ error: 'Canal no encontrado' });
  }
  if (!channel.isActive) {
    return res.status(400).json({ error: 'El canal está inactivo' });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Falta el archivo de vídeo (campo «video»)' });
  }

  const effectiveOrgId = orgId ?? channel.organizationId;

  try {
    await assertOrgCanTriggerPipeline(effectiveOrgId);

    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : undefined;

    const result = await handleLongVideoUpload({
      channelId: channel.id,
      organizationId: effectiveOrgId,
      originalFilename: file.originalname,
      buffer: file.buffer,
      title,
    });

    res.status(202).json(result);
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return res.status(err.statusCode).json(planLimitErrorBody(err));
    }
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : 500;
    const message = err instanceof Error ? err.message : 'No se pudo procesar la subida';
    res.status(statusCode).json({ error: message });
  }
});

channelsRouter.get('/:id/youtube-analytics', async (req, res) => {
  const orgId = orgScope(req);
  if (orgId && !(await assertChannelInOrg(req.params.id, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  const data = await getChannelYouTubeAnalytics(req.params.id);
  res.json(data);
});

channelsRouter.post('/:id/youtube-analytics/sync', async (req, res) => {
  const orgId = orgScope(req);
  if (orgId && !(await assertChannelInOrg(req.params.id, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  const result = await syncChannelYouTubeAnalytics(req.params.id);
  const { getChannelPublicationPlan } = await import('../lib/publication-plan.js');
  const plan = await getChannelPublicationPlan(req.params.id);
  res.json({
    ...result,
    plannerFeedback: plan.plannerFeedback ?? [],
    message:
      result.synced > 0
        ? `Sincronizados ${result.synced} vídeo(s)`
        : 'No hay vídeos publicados con ID de YouTube para sincronizar',
  });
});

channelsRouter.get('/:id/analytics-insights', async (req, res) => {
  const orgId = orgScope(req);
  if (orgId && !(await assertChannelInOrg(req.params.id, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  const insights = await getChannelAnalyticsInsights(req.params.id);
  res.json(insights);
});

/** Aplica hora/días recomendados del insight al planner del canal. */
channelsRouter.post('/:id/apply-publish-insights', async (req, res) => {
  const orgId = orgScope(req);
  if (orgId && !(await assertChannelInOrg(req.params.id, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const channel = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const insights = await getChannelAnalyticsInsights(req.params.id);
  const hour = insights.recommendedHour;
  if (hour == null || !Number.isFinite(hour)) {
    return res.status(400).json({
      error: 'Aún no hay hora recomendada. Sincroniza analíticas tras publicar varios vídeos.',
    });
  }

  const current = parseChannelConfig(channel.config);
  const dayScores = insights.publish?.dayScores ?? {};
  const preferredDays =
    Object.keys(dayScores).length > 0
      ? Object.entries(dayScores)
          .sort((a, b) => b[1] - a[1])
          .map(([d]) => Number(d))
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          .slice(0, 4)
      : current.preferredPublishDays;

  const nextConfig = {
    ...current,
    preferredPublishHour: Math.max(0, Math.min(23, Math.round(hour))),
    ...(preferredDays && preferredDays.length > 0 ? { preferredPublishDays: preferredDays } : {}),
  };

  const updated = await prisma.channel.update({
    where: { id: channel.id },
    data: { config: nextConfig },
  });

  res.json({
    message: `Planner actualizado: hora preferida ${String(nextConfig.preferredPublishHour).padStart(2, '0')}:00`,
    preferredPublishHour: nextConfig.preferredPublishHour,
    preferredPublishDays: nextConfig.preferredPublishDays,
    channel: updated,
  });
});

channelsRouter.get('/:id', async (req, res) => {
  const orgId = orgScope(req);
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.id },
    include: { promptBindings: { include: { promptVersion: true } } },
  });
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  if (orgId && channel.organizationId !== orgId) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  res.json(channel);
});

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  niche: z.string().min(1),
  config: channelConfigSchema.partial().optional(),
});

channelsRouter.post('/', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Se requiere autenticación para crear canales' });
  }

  const body = createSchema.parse(req.body);

  const limits = await resolveOrgPlanLimits(orgId);
  if (!limits.unlimited && typeof limits.maxChannels === 'number') {
    const channelCount = await prisma.channel.count({ where: { organizationId: orgId } });
    if (channelCount >= limits.maxChannels) {
      return res.status(403).json({
        error:
          limits.maxChannels === 1
            ? 'Tu plan permite un solo canal. Mejora de plan para crear más canales.'
            : `Tu plan permite un máximo de ${limits.maxChannels} canales. Mejora de plan para crear más.`,
        code: 'CHANNEL_LIMIT_REACHED',
        limit: limits.maxChannels,
        current: channelCount,
      });
    }
  }

  const config = parseChannelConfig({
    niche: body.niche,
    videoFormat: 'shorts',
    aspectRatio: '9:16',
    templateId: 'shorts-default',
    ideasPerRun: 5,
    language: 'es',
    visualSourceMode: 'mixed',
    ...body.config,
  });

  const violations = validateChannelCompliance(config, {
    channelName: body.name,
    channelNiche: body.niche,
  });
  if (violations.length > 0) {
    return res.status(422).json({
      error: 'El canal no cumple la política de contenido',
      violations,
    });
  }

  const existingSlug = await prisma.channel.findUnique({
    where: { organizationId_slug: { organizationId: orgId, slug: body.slug } },
  });
  if (existingSlug) {
    return res.status(409).json({ error: 'Ya existe un canal con ese slug en la organización' });
  }

  const channel = await prisma.channel.create({
    data: {
      organizationId: orgId,
      name: body.name,
      slug: body.slug,
      niche: body.niche,
      config: config as object,
    },
  });
  res.status(201).json(channel);
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  config: channelConfigSchema.partial().optional(),
});

channelsRouter.patch('/:id', async (req, res) => {
  const orgId = orgScope(req);
  const existing = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Channel not found' });
  if (orgId && !(await assertChannelInOrg(existing.id, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const body = patchSchema.parse(req.body);

  const mergedConfig = body.config
    ? parseChannelConfig({ ...(existing.config as object), ...body.config })
    : undefined;

  if (mergedConfig) {
    const violations = validateChannelCompliance(mergedConfig, {
      channelName: body.name ?? existing.name,
      channelNiche: existing.niche,
    });
    if (violations.length > 0) {
      return res.status(422).json({
        error: 'El canal no cumple la política de contenido',
        violations,
      });
    }
  }

  const channel = await prisma.channel.update({
    where: { id: req.params.id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(mergedConfig ? { config: mergedConfig as object } : {}),
    },
  });

  res.json(channel);
});

channelsRouter.delete('/:id', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Se requiere autenticación para eliminar canales' });
  }

  const existing = await prisma.channel.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Canal no encontrado' });
  if (!(await assertChannelInOrg(existing.id, orgId))) {
    return res.status(404).json({ error: 'Canal no encontrado' });
  }

  try {
    await deleteChannelWithCleanup(existing.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[channels] Error eliminando canal:', err);
    return res.status(500).json({ error: 'No se pudo eliminar el canal' });
  }
});
