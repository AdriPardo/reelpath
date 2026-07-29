import { Router } from 'express';
import { z } from 'zod';
import { parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { enqueuePipeline, enqueuePipelineStep } from '@autotube/job-queue';
import type { PipelineStep, ScriptVariant } from '@autotube/shared';
import { PIPELINE_STEPS, parseScheduledPublishAt } from '@autotube/shared';
import { cancelPipelineRun } from '../lib/pipeline-cancel.js';
import { resolveChannelAutoPublishAt } from '../lib/publication-plan.js';
import {
  deleteSceneAssets,
  enqueueSceneRerender,
  loadScriptVariant,
  normalizeScenes,
} from '../lib/script-editor.js';
import {
  listStuckPipelines,
  recoverAllStuckPipelines,
  recoverPipelineRun,
} from '../lib/pipeline-recovery.js';
import { assertOrgCanTriggerPipeline, PlanLimitError, planLimitErrorBody } from '../lib/plan-limits.js';
import { localeFromRequest } from '../lib/request-locale.js';
import { assertChannelInOrg } from '../lib/tenant.js';
import { authMiddleware, orgChannelIds, orgScope } from '../middleware/auth.js';
import { pipelineTriggerRateLimiter } from '../middleware/rate-limit.js';
import { paginatedResponse, parsePagination } from '../lib/pagination.js';

export const pipelinesRouter = Router();

pipelinesRouter.use(authMiddleware);

async function scopedChannelFilter(req: Parameters<typeof orgChannelIds>[0]) {
  const ids = await orgChannelIds(req);
  if (ids === null) return undefined;
  return { channelId: { in: ids } };
}

async function assertPipelineInOrg(pipelineId: string, orgId: string | undefined): Promise<boolean> {
  if (!orgId) return true;
  const run = await prisma.pipelineRun.findUnique({
    where: { id: pipelineId },
    include: { channel: { select: { organizationId: true } } },
  });
  return !!run && run.channel.organizationId === orgId;
}

pipelinesRouter.get('/', async (req, res) => {
  const { channelId, active, status, filter } = req.query;
  const orgId = orgScope(req);
  const orgFilter = await scopedChannelFilter(req);

  if (channelId && orgId && !(await assertChannelInOrg(String(channelId), orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const pagination = parsePagination(req.query as Record<string, unknown>);

  const PIPELINE_IDLE_STATUSES = [
    'completed',
    'failed',
    'rejected',
    'pending_review',
    'cancelled',
  ] as const;

  const filterKey = typeof filter === 'string' ? filter : undefined;
  const statusFilter =
    active === 'true' || active === '1' || filterKey === 'active'
      ? { status: { notIn: [...PIPELINE_IDLE_STATUSES] } }
      : filterKey === 'done'
        ? { status: 'completed' }
        : filterKey === 'failed'
          ? { status: 'failed' }
          : status
            ? { status: String(status) }
            : {};

  const baseWhere = {
    ...(orgFilter ?? {}),
    ...(channelId ? { channelId: String(channelId) } : {}),
  };

  const where = {
    ...baseWhere,
    ...statusFilter,
  };

  const [runs, total, countAll, countActive, countDone, countFailed] = await Promise.all([
    prisma.pipelineRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        channel: { select: { id: true, name: true, slug: true } },
        videos: { select: { id: true, title: true, reviewStatus: true }, take: 1 },
      },
    }),
    prisma.pipelineRun.count({ where }),
    prisma.pipelineRun.count({ where: baseWhere }),
    prisma.pipelineRun.count({
      where: { ...baseWhere, status: { notIn: [...PIPELINE_IDLE_STATUSES] } },
    }),
    prisma.pipelineRun.count({ where: { ...baseWhere, status: 'completed' } }),
    prisma.pipelineRun.count({ where: { ...baseWhere, status: 'failed' } }),
  ]);

  return res.json({
    ...paginatedResponse(runs, total, pagination),
    counts: {
      all: countAll,
      active: countActive,
      done: countDone,
      failed: countFailed,
    },
  });
});

pipelinesRouter.get('/stuck/list', async (req, res) => {
  const staleMinutes = Number(req.query.minutes) || 10;
  const stuck = await listStuckPipelines(staleMinutes);
  const orgId = orgScope(req);
  if (!orgId) {
    res.json(stuck);
    return;
  }
  const allowed = await orgChannelIds(req);
  res.json(stuck.filter((s) => allowed?.includes(s.channelId)));
});

pipelinesRouter.post('/recover-stuck', async (req, res) => {
  try {
    const staleMinutes = Number(req.body?.staleMinutes) || 10;
    const force = req.body?.force === true;
    const orgId = orgScope(req);
    const channelIds = orgId ? await orgChannelIds(req) : null;
    const summary = await recoverAllStuckPipelines(staleMinutes, force, channelIds);
    res.json(summary);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Error al recuperar pipelines',
    });
  }
});

const triggerSchema = z.object({
  channelId: z.string().min(1),
  topic: z.string().min(2).max(200).optional(),
  scheduledPublishAt: z.string().min(1).optional(),
});

pipelinesRouter.post('/trigger', pipelineTriggerRateLimiter, async (req, res) => {
  try {
    const { channelId, topic, scheduledPublishAt: scheduledRaw } = triggerSchema.parse(req.body);
    const orgId = orgScope(req);

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    if (orgId && channel.organizationId !== orgId) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    if (!channel.isActive) return res.status(400).json({ error: 'El canal está inactivo' });

    const effectiveOrgId = orgId ?? channel.organizationId;
    const locale = localeFromRequest(req);
    await assertOrgCanTriggerPipeline(effectiveOrgId, locale);

    const config = parseChannelConfig(channel.config);
    const explicitSchedule = parseScheduledPublishAt(scheduledRaw);
    const autoSchedule = await resolveChannelAutoPublishAt(channelId, config, explicitSchedule);
    const metadata: Record<string, string> = {};
    if (topic) metadata.forcedTopic = topic;
    if (autoSchedule) metadata.scheduledPublishAt = autoSchedule.toISOString();

    const run = await prisma.pipelineRun.create({
      data: {
        channelId,
        status: 'scheduled',
        currentStep: 'generate_ideas',
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      },
    });

    const job = await enqueuePipeline({ pipelineRunId: run.id, channelId });

    res.status(202).json({ pipelineRun: run, jobId: job.id, message: 'Pipeline encolado' });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return res.status(err.statusCode).json(planLimitErrorBody(err));
    }
    console.error('[pipelines/trigger]', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'No se pudo encolar el pipeline',
    });
  }
});

pipelinesRouter.get('/:id', async (req, res) => {
  const orgId = orgScope(req);
  if (!(await assertPipelineInOrg(req.params.id, orgId))) {
    return res.status(404).json({ error: 'Pipeline run not found' });
  }

  const run = await prisma.pipelineRun.findUnique({
    where: { id: req.params.id },
    include: {
      channel: true,
      ideas: { orderBy: { viralScore: 'desc' } },
      scripts: true,
      mediaAssets: true,
      videos: true,
    },
  });
  if (!run) return res.status(404).json({ error: 'Pipeline run not found' });

  const clips = await prisma.videoClip.findMany({
    where: { pipelineRunId: run.id },
    orderBy: { partIndex: 'asc' },
  });

  res.json({ ...run, clips });
});

pipelinesRouter.post('/:id/retry', async (req, res) => {
  const orgId = orgScope(req);
  if (!(await assertPipelineInOrg(req.params.id, orgId))) {
    return res.status(404).json({ error: 'Pipeline run not found' });
  }

  const run = await prisma.pipelineRun.findUnique({ where: { id: req.params.id } });
  if (!run) return res.status(404).json({ error: 'Pipeline run not found' });

  if (run.status !== 'failed') {
    return res.status(400).json({ error: 'Solo se pueden reintentar pipelines fallidos' });
  }

  const step = (run.currentStep ?? 'generate_ideas') as PipelineStep;
  if (!PIPELINE_STEPS.includes(step)) {
    return res.status(400).json({ error: `Paso inválido: ${step}` });
  }

  await prisma.pipelineRun.update({
    where: { id: run.id },
    data: { status: 'scheduled', error: null },
  });

  await enqueuePipelineStep({ pipelineRunId: run.id, channelId: run.channelId }, step, {
    replace: true,
  });

  res.json({ id: run.id, step, message: 'Pipeline reencolado para reintento' });
});

pipelinesRouter.post('/:id/cancel', async (req, res) => {
  try {
    const orgId = orgScope(req);
    if (!(await assertPipelineInOrg(req.params.id, orgId))) {
      return res.status(404).json({ error: 'Pipeline run not found' });
    }

    const result = await cancelPipelineRun(req.params.id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo cancelar el pipeline';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

pipelinesRouter.post('/:id/resume', async (req, res) => {
  try {
    const orgId = orgScope(req);
    if (!(await assertPipelineInOrg(req.params.id, orgId))) {
      return res.status(404).json({ error: 'Pipeline run not found' });
    }

    const force = req.query.force === 'true' || req.body?.force === true;
    const result = await recoverPipelineRun(req.params.id, { force });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo reanudar';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

const patchScriptSchema = z.object({
  hook: z.string().min(1).max(300).optional(),
  scenes: z
    .array(
      z.object({
        index: z.number().int().min(0).optional(),
        narration: z.string().min(1).max(3000),
        visualPrompt: z.string().min(1).max(800).optional(),
        durationSec: z.number().min(1).max(180).optional(),
      }),
    )
    .min(1)
    .optional(),
});

pipelinesRouter.patch('/:id/script', async (req, res) => {
  const orgId = orgScope(req);
  if (!(await assertPipelineInOrg(req.params.id, orgId))) {
    return res.status(404).json({ error: 'Generación no encontrada' });
  }

  const body = patchScriptSchema.parse(req.body);
  if (!body.hook && !body.scenes) {
    return res.status(400).json({ error: 'Indica hook o escenas para actualizar' });
  }

  const run = await prisma.pipelineRun.findUnique({
    where: { id: req.params.id },
    include: { videos: { select: { reviewStatus: true } } },
  });
  if (!run) return res.status(404).json({ error: 'Generación no encontrada' });

  const video = run.videos[0];
  if (video && video.reviewStatus === 'published') {
    return res.status(400).json({ error: 'No se puede editar un vídeo ya publicado' });
  }

  const script = await prisma.script.findFirst({ where: { pipelineRunId: run.id } });
  if (!script) return res.status(404).json({ error: 'Guion no encontrado' });

  const variant = script.selectedVariant as unknown as ScriptVariant;
  const updated: ScriptVariant = {
    ...variant,
    ...(body.hook ? { hook: body.hook } : {}),
    ...(body.scenes
      ? {
          scenes: normalizeScenes(
            body.scenes.map((s, i) => ({
              index: s.index ?? i,
              narration: s.narration,
              visualPrompt: s.visualPrompt ?? variant.scenes[i]?.visualPrompt ?? '',
              durationSec: s.durationSec ?? variant.scenes[i]?.durationSec ?? 5,
            })),
          ),
        }
      : {}),
  };

  await prisma.script.update({
    where: { id: script.id },
    data: { selectedVariant: updated as unknown as object },
  });

  res.json({ pipelineRunId: run.id, script: updated, message: 'Guion actualizado' });
});
