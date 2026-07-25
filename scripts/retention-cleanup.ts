import 'dotenv/config';
/**
 * Limpieza de storage de pipelines antiguos.
 *
 * Ejemplo crontab (diario a las 3:00 AM):
 *   0 3 * * * cd /opt/reelpath && RETENTION_DAYS=30 npm run retention:cleanup >> /var/log/reelpath-retention.log 2>&1
 *
 * Ver también docs/DEPLOY.md
 */
import { loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { cleanupPipelineRunStorage } from '../backend/api/src/lib/pipeline-cleanup.js';

const retentionDays = Number(process.env.RETENTION_DAYS ?? 30);
if (!Number.isFinite(retentionDays) || retentionDays < 1) {
  throw new Error('RETENTION_DAYS debe ser un entero >= 1');
}

const cfg = loadConfig();
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

async function main() {
  if (cfg.NODE_ENV === 'production' && cfg.MOCK_EXTERNAL_APIS) {
    throw new Error('retention-cleanup: en producción no se permite MOCK_EXTERNAL_APIS=true');
  }

  const runs = await prisma.pipelineRun.findMany({
    where: {
      completedAt: { lt: cutoff },
      status: { in: ['completed', 'failed', 'canceled'] },
    },
    select: { id: true, completedAt: true, status: true },
    orderBy: { completedAt: 'asc' },
    take: 500,
  });

  let cleaned = 0;
  for (const run of runs) {
    if (!run.completedAt) continue;
    await cleanupPipelineRunStorage(run.id).catch(() => undefined);
    cleaned++;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        retentionDays,
        cutoff: cutoff.toISOString(),
        candidates: runs.length,
        cleaned,
      },
      null,
      2,
    ),
  );
}

await main().finally(async () => {
  await prisma.$disconnect().catch(() => undefined);
});

