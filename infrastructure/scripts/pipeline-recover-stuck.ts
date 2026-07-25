#!/usr/bin/env tsx
/**
 * Reencola pipelines atascados (worker caído, Redis reiniciado, etc.)
 *
 * Uso:
 *   npm run pipeline:recover          # atascados >10 min
 *   npm run pipeline:recover -- --list
 *   npm run pipeline:recover -- --force <pipelineRunId>
 *   npm run pipeline:recover -- --all --force
 */
import 'dotenv/config';
import { prisma } from '@autotube/database';
import {
  listStuckPipelines,
  recoverAllStuckPipelines,
  recoverPipelineRun,
} from '../../backend/api/src/lib/pipeline-recovery.js';

async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const force = args.includes('--force');
  const all = args.includes('--all');
  const staleIdx = args.indexOf('--minutes');
  const staleMinutes = staleIdx >= 0 ? Number(args[staleIdx + 1]) || 10 : 10;
  const idArg = args.find((a) => !a.startsWith('--') && a.length > 8);

  if (listOnly) {
    const stuck = await listStuckPipelines(staleMinutes);
    if (stuck.length === 0) {
      console.log(`No hay pipelines atascados (umbral ${staleMinutes} min).`);
      return;
    }
    console.log(`Pipelines atascados (${stuck.length}):\n`);
    for (const s of stuck) {
      const age = Math.round((Date.now() - new Date(s.updatedAt).getTime()) / 60000);
      console.log(
        `  ${s.id}  ${s.status.padEnd(18)} ${(s.currentStep ?? '—').padEnd(16)}  ${age}m  ${s.topic ?? s.channel ?? ''}`,
      );
    }
    return;
  }

  if (idArg) {
    const res = await recoverPipelineRun(idArg, { force: force || true, staleMinutes });
    console.log(`✅ ${res.message}`);
    console.log(`   jobId: ${res.jobId}`);
    return;
  }

  if (all) {
    const summary = await recoverAllStuckPipelines(staleMinutes, force);
    console.log(`\n✅ Recuperados ${summary.recovered}/${summary.total} pipelines\n`);
    for (const r of summary.results) {
      console.log(`  ${r.ok ? '✓' : '✗'} ${r.id.slice(0, 14)}…  ${r.message}`);
    }
    return;
  }

  const summary = await recoverAllStuckPipelines(staleMinutes, false);
  if (summary.total === 0) {
    console.log(`No hay pipelines atascados (>${staleMinutes} min sin actualizar).`);
    console.log('Usa --list para verificar o --all --force para forzar.');
    return;
  }

  console.log(`\n✅ Recuperados ${summary.recovered}/${summary.total} pipelines\n`);
  for (const r of summary.results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.id.slice(0, 14)}…  ${r.message}`);
  }
  console.log('\nAsegúrate de tener npm run dev corriendo (worker activo).\n');
}

main()
  .catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
