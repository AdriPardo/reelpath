import { setTimeout as sleep } from 'node:timers/promises';

type HealthResponse = Record<string, unknown>;

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; json: HealthResponse | null; text?: string }> {
  const res = await fetch(url, { headers: { 'user-agent': 'reelpath-healthcheck' } });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text) as HealthResponse };
  } catch {
    return { ok: res.ok, status: res.status, json: null, text };
  }
}

async function main() {
  const baseUrl = process.env.HEALTHCHECK_URL ?? 'http://localhost:4000';
  const endpoints = ['/health', '/ready', '/health/extended', '/metrics'];

  const results: Array<{ endpoint: string; ok: boolean; status: number }> = [];

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    const r = await fetchJson(url);
    results.push({ endpoint, ok: r.ok, status: r.status });

    if (!r.ok) {
      console.error(`[healthcheck] FAIL ${endpoint} status=${r.status}`);
      if (r.json) console.error('[healthcheck] body:', JSON.stringify(r.json, null, 2));
      else if (r.text) console.error('[healthcheck] body:', r.text.slice(0, 2000));
      process.exitCode = 1;
      return;
    }

    if (endpoint === '/health/extended' && r.json) {
      const degraded = r.json.status !== 'ok';
      if (degraded) {
        console.error('[healthcheck] Degraded:', JSON.stringify(r.json, null, 2));
        process.exitCode = 1;
        return;
      }
    }

    // evita rate-limit si se ejecuta en loops/cron
    await sleep(50);
  }

  console.log('[healthcheck] OK', results);
}

await main();

