import { api, getApiUrl, type PipelineRun } from '@/lib/api';

export interface TriggerPipelineOptions {
  channelId: string;
  topic?: string;
  scheduledPublishAt?: string;
}

export interface TriggerPipelineResult {
  pipelineRun: PipelineRun;
  jobId: string;
  message: string;
}

/** Comprueba si la API está en marcha; lanza si no responde. */
export async function assertApiOnline(): Promise<void> {
  const health = await fetch(`${getApiUrl()}/health`, { cache: 'no-store' });
  if (!health.ok) throw new Error('offline');
}

/** Devuelve `useMocks` del health endpoint, o `null` si falla la petición. */
export async function fetchApiMockMode(): Promise<boolean | null> {
  try {
    const health = await fetch(`${getApiUrl()}/health`, { cache: 'no-store' });
    if (!health.ok) return null;
    const data = (await health.json()) as { useMocks?: boolean };
    return data.useMocks ?? null;
  } catch {
    return null;
  }
}

export async function triggerPipeline(options: TriggerPipelineOptions): Promise<TriggerPipelineResult> {
  await assertApiOnline();
  return api<TriggerPipelineResult>('/api/pipelines/trigger', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}
