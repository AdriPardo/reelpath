import 'dotenv/config';
import { createPipelineWorker } from '@autotube/job-queue';
import { processPipelineJob } from './pipeline.js';
import { captureWorkerError, initSentryForWorker, Sentry } from './sentry.js';

initSentryForWorker();

const worker = createPipelineWorker(async (job) => {
  console.log(`[worker] Processing step: ${job.data.step ?? job.name} run=${job.data.pipelineRunId}`);
  await processPipelineJob(job);
  console.log(`[worker] Completed step: ${job.data.step ?? job.name}`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job failed: ${job?.id}`, err.message);
  captureWorkerError(err, job ?? undefined);
});

worker.on('ready', () => {
  console.log('[worker] AutoTube pipeline worker ready');
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] Shutting down (${signal})...`);

  const forceExit = setTimeout(() => process.exit(1), 5000);
  forceExit.unref();

  await worker.close(true);
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[worker] unhandledRejection:', reason);
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (err) => {
  console.error('[worker] uncaughtException:', err);
  Sentry.captureException(err);
});
