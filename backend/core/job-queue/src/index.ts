import { Queue, Worker, type Job, type ConnectionOptions } from 'bullmq';
import { loadConfig } from '@autotube/config';
import { QUEUE_NAMES, type PipelineJobPayload } from '@autotube/shared';

let connection: ConnectionOptions | null = null;

export function getRedisConnection(): ConnectionOptions {
  if (!connection) {
    connection = { url: loadConfig().REDIS_URL };
  }
  return connection;
}

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      }),
    );
  }
  return queues.get(name)!;
}

export function getPipelineQueue(): Queue<PipelineJobPayload> {
  return getQueue(QUEUE_NAMES.PIPELINE) as Queue<PipelineJobPayload>;
}

export type EnqueuePipelineOptions = {
  /** Reemplaza jobs en cola/fallidos; reencola si el paso activo lleva demasiado tiempo. */
  replace?: boolean;
  /** Retraso en ms antes de ejecutar el job (BullMQ delayed). */
  delay?: number;
};

const STALE_ACTIVE_MS = 15 * 60 * 1000;

function isStaleActiveJob(job: Job): boolean {
  const started = job.processedOn ?? job.timestamp;
  return Date.now() - started > STALE_ACTIVE_MS;
}

/** Elimina un job de paso concreto (p. ej. publish atascado) para permitir reintento. */
export async function removePipelineStepJob(
  pipelineRunId: string,
  step: string,
): Promise<boolean> {
  const jobId = `${pipelineRunId}__${step}`;
  const job = await getPipelineQueue().getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'active' && !isStaleActiveJob(job)) {
    return false;
  }

  try {
    await job.remove();
    return true;
  } catch {
    return false;
  }
}

async function removeLegacyDuplicateJobs(pipelineRunId: string, step: string): Promise<void> {
  const queue = getPipelineQueue();
  const prefix = `${pipelineRunId}__${step}__`;
  for (const state of ['waiting', 'delayed'] as const) {
    const jobs = await queue.getJobs([state], 0, 200);
    for (const job of jobs) {
      if (job.id?.startsWith(prefix)) {
        await job.remove();
      }
    }
  }
}

export async function enqueuePipelineStep(
  payload: PipelineJobPayload,
  step: string,
  options?: EnqueuePipelineOptions,
): Promise<Job<PipelineJobPayload>> {
  const jobId = `${payload.pipelineRunId}__${step}`;
  const queue = getPipelineQueue();

  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === 'active') {
      if (options?.replace) {
        if (isStaleActiveJob(existing)) {
          await existing.remove();
        } else {
          // Idempotente: otro clic en "Aprobar" o reintento mientras sube a YouTube.
          return existing;
        }
      } else {
        return existing;
      }
    }
    if (options?.replace || state === 'failed' || state === 'completed') {
      await existing.remove();
    } else if (state === 'waiting' || state === 'delayed') {
      return existing;
    }
  }

  await removeLegacyDuplicateJobs(payload.pipelineRunId, step);

  const delay = options?.delay;
  return queue.add(step, { ...payload, step }, { jobId, ...(delay ? { delay } : {}) });
}

export async function enqueuePipeline(payload: PipelineJobPayload): Promise<Job<PipelineJobPayload>> {
  return enqueuePipelineStep(payload, 'generate_ideas');
}

function getWorkerConcurrency(): number {
  const raw = process.env.WORKER_CONCURRENCY;
  if (raw !== undefined) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  // Default 1: un pipeline a la vez. En VPS 4–8 vCPU, FFmpeg ya satura CPU;
  // subir solo si hay cores de sobra y FFMPEG_THREADS bajo.
  return 1;
}

export function createPipelineWorker(
  processor: (job: Job<PipelineJobPayload>) => Promise<void>,
): Worker<PipelineJobPayload> {
  return new Worker<PipelineJobPayload>(QUEUE_NAMES.PIPELINE, processor, {
    connection: getRedisConnection(),
    concurrency: getWorkerConcurrency(),
  });
}

export async function closeQueues(): Promise<void> {
  for (const q of queues.values()) {
    await q.close();
  }
  queues.clear();
}

/** Elimina jobs BullMQ de un pipeline (waiting/delayed/failed/completed). Los activos no se pueden cancelar. */
export async function cancelPipelineJobsForRun(
  pipelineRunId: string,
): Promise<{ removed: number; active: number }> {
  const queue = getPipelineQueue();
  let removed = 0;
  let active = 0;

  for (const state of ['waiting', 'delayed', 'failed', 'completed'] as const) {
    const jobs = await queue.getJobs([state], 0, 200);
    for (const job of jobs) {
      if (job.id?.startsWith(pipelineRunId)) {
        await job.remove();
        removed++;
      }
    }
  }

  const activeJobs = await queue.getJobs(['active'], 0, 50);
  for (const job of activeJobs) {
    if (job.id?.startsWith(pipelineRunId)) {
      active++;
    }
  }

  return { removed, active };
}
