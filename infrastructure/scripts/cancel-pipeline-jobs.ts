#!/usr/bin/env tsx
/** Cancela jobs BullMQ de un pipeline (waiting/delayed/failed/completed). */
import 'dotenv/config';
import { cancelPipelineJobsForRun, getPipelineQueue } from '@autotube/job-queue';

const pipelineRunId = process.argv[2];
if (!pipelineRunId) {
  console.error('Uso: tsx cancel-pipeline-jobs.ts <pipelineRunId>');
  process.exit(1);
}

async function main() {
  const { removed, active } = await cancelPipelineJobsForRun(pipelineRunId);
  if (active > 0) {
    console.log(`${active} job(s) activo(s) no se pudieron cancelar`);
  }
  console.log(`\nTotal eliminados: ${removed}`);
  await getPipelineQueue().close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
