#!/usr/bin/env tsx
/**
 * Limpia storage huérfano y vídeos legacy rejected.
 * Uso: npm run storage:cleanup [-- --orphans] [-- --rejected] [-- --all]
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath } from '@autotube/config';
import { prisma } from '@autotube/database';
import { deletePipelineRunCompletely } from '../../backend/api/src/lib/pipeline-cleanup.js';

const args = new Set(process.argv.slice(2));
const runOrphans = args.has('--orphans') || args.has('--all') || args.size === 0;
const runRejected = args.has('--rejected') || args.has('--all') || args.size === 0;

async function cleanupOrphans(): Promise<number> {
  const runs = await prisma.pipelineRun.findMany({ select: { id: true } });
  const knownIds = new Set(runs.map((r) => r.id));
  let removed = 0;

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
        await fs.rm(path.join(root, entry), { recursive: true, force: true });
        console.info(`[cleanup] Huérfano eliminado: ${sub}/${entry}`);
        removed++;
      }
    }
  }
  return removed;
}

async function cleanupRejected(): Promise<number> {
  const legacy = await prisma.video.findMany({
    where: { reviewStatus: 'rejected' },
    select: { id: true, pipelineRunId: true, title: true },
  });

  for (const v of legacy) {
    await deletePipelineRunCompletely(v.pipelineRunId);
    console.info(`[cleanup] Rechazado legacy eliminado: ${v.title} (${v.id})`);
  }
  return legacy.length;
}

async function main() {
  let total = 0;
  if (runOrphans) {
    const n = await cleanupOrphans();
    console.info(`Carpetas huérfanas eliminadas: ${n}`);
    total += n;
  }
  if (runRejected) {
    const n = await cleanupRejected();
    console.info(`Vídeos rejected legacy eliminados: ${n}`);
    total += n;
  }
  console.info(`Limpieza completada (${total} operaciones).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
