import 'dotenv/config';
import {
  closeQueues,
  createMaintenanceWorker,
  createPipelineWorker,
  ensureAutoGenerateSweepSchedule,
} from '@autotube/job-queue';
import { processPipelineJob } from './pipeline.js';
import { runAutoGenerateSweep } from './auto-generate-sweep.js';
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

const maintenanceWorker = createMaintenanceWorker(async (job) => {
  if (job.data.kind !== 'auto_generate_sweep') {
    console.warn(`[worker] Unknown maintenance job: ${job.name}`);
    return;
  }
  console.info('[worker] auto_generate_sweep start');
  const result = await runAutoGenerateSweep();
  console.info(
    `[worker] auto_generate_sweep done checked=${result.checked} triggered=${result.triggered} skipped=${result.skipped}`,
  );
});

maintenanceWorker.on('failed', (job, err) => {
  console.error(`[worker] Maintenance job failed: ${job?.id}`, err.message);
  captureWorkerError(err, job ?? undefined);
});

worker.on('ready', () => {
  console.log('[worker] AutoTube pipeline worker ready');
  void (async () => {
    try {
      const {
        importPlatformSecretsFromEnvIfEmpty,
        loadPlatformSecretsOverrides,
      } = await import('@autotube/database');
      await importPlatformSecretsFromEnvIfEmpty({
        YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
        YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        PEXELS_API_KEY: process.env.PEXELS_API_KEY,
      });
      await loadPlatformSecretsOverrides();
    } catch (err) {
      console.warn('[worker] No se pudieron cargar secretos de plataforma:', err);
    }
    try {
      await ensureAutoGenerateSweepSchedule();
      console.log('[worker] auto_generate_sweep scheduled (hourly)');
    } catch (err) {
      console.warn('[worker] No se pudo programar auto_generate_sweep:', err);
    }
  })();
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] Shutting down (${signal})...`);

  const forceExit = setTimeout(() => process.exit(1), 5000);
  forceExit.unref();

  await Promise.all([worker.close(true), maintenanceWorker.close(true)]);
  await closeQueues();
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
