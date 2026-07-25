import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath } from '@autotube/config';
import { prisma } from '@autotube/database';
import { getStorageStats } from '../lib/storage-stats.js';
import { deletePipelineRunCompletely } from '../lib/pipeline-cleanup.js';
import { authMiddleware, orgChannelIds, requireAdmin } from '../middleware/auth.js';

export const systemRouter = Router();

systemRouter.use(authMiddleware);
systemRouter.use(requireAdmin);

systemRouter.get('/storage', async (_req, res) => {
  const stats = await getStorageStats();
  res.json(stats);
});

/** Elimina carpetas en storage sin pipeline run en BD. */
systemRouter.post('/storage/cleanup-orphans', async (_req, res) => {
  const runs = await prisma.pipelineRun.findMany({ select: { id: true } });
  const knownIds = new Set(runs.map((r) => r.id));

  const removed: string[] = [];

  for (const sub of ['pipelines', 'videos'] as const) {
    const root = getStoragePath(sub);
    let entries: string[] = [];
    try {
      entries = await fs.readdir(root);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!knownIds.has(entry)) {
        const target = path.join(root, entry);
        await fs.rm(target, { recursive: true, force: true }).catch(() => undefined);
        removed.push(target);
      }
    }
  }

  res.json({
    message: `${removed.length} carpetas huérfanas eliminadas`,
    removed,
  });
});

/** Elimina vídeos legacy con estado rejected (pre-borrado automático). */
systemRouter.post('/storage/cleanup-rejected', async (req, res) => {
  const orgChannelIdList = await orgChannelIds(req);
  const legacy = await prisma.video.findMany({
    where: {
      reviewStatus: 'rejected',
      ...(orgChannelIdList ? { channelId: { in: orgChannelIdList } } : {}),
    },
    select: { id: true, pipelineRunId: true },
  });

  const deleted: string[] = [];
  for (const v of legacy) {
    await deletePipelineRunCompletely(v.pipelineRunId);
    deleted.push(v.id);
  }

  res.json({
    message: `${deleted.length} vídeos rechazados legacy eliminados`,
    deleted,
  });
});
