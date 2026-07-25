import { test, expect } from '@playwright/test';
import { ensureSessionViaApi, setSessionToken } from '../helpers/auth';

function uniqueEmail(prefix = 'e2e') {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

const API_URL = process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function apiJson<T>(request: any, token: string, path: string): Promise<T> {
  const res = await request.get(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok()) throw new Error(`GET ${path} failed (${res.status()}): ${text}`);
  return JSON.parse(text) as T;
}

test('canal -> generación (mock) -> revisión -> programar', async ({ page, request }) => {
  const email = uniqueEmail('core');
  const password = 'password-e2e-123';
  const { token } = await ensureSessionViaApi(request, { email, password, name: 'E2E Core' });

  await setSessionToken(page, token);
  await page.goto('/');

  // Dashboard carga (usuarios nuevos ven empty state, no el grid de stats).
  await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio|Hi,|Dashboard/ })).toBeVisible();

  await page.goto('/channels');

  await page.getByTestId('channel-name').fill('Canal E2E');
  await page.getByTestId('channel-niche').fill('historia');
  await page.getByTestId('channel-create-submit').click();

  await expect(page).toHaveURL(/\/channels\/[^/]+/);
  const channelId = page.url().split('/channels/')[1]!.split(/[?#]/)[0]!;

  // Forzar revisión manual (el default de plataforma puede publicar sin pending).
  const patchRes = await request.patch(`${API_URL}/api/channels/${channelId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { config: { reviewRequired: true, autoReview: false, autoPublish: false } },
  });
  expect(patchRes.ok(), await patchRes.text()).toBeTruthy();

  await page.goto('/channels');
  await page.getByTestId(`channel-generate-${channelId}`).click();

  await expect(page).toHaveURL(/\/pipelines\/[^/]+/);
  const pipelineId = page.url().split('/pipelines/')[1]!.split(/[?#]/)[0]!;

  // Espera a estado terminal (incluye pasos reales: generating_*, rendering_video, etc.).
  await expect
    .poll(
      async () => {
        const res = await request.get(`${API_URL}/api/pipelines/${pipelineId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as { status: string; error?: string | null };
        if (/^(failed|cancelled)$/i.test(data.status)) {
          throw new Error(
            `Pipeline terminó en ${data.status}${data.error ? ` — ${data.error}` : ''}`,
          );
        }
        return data.status;
      },
      { timeout: 8 * 60_000, intervals: [2000, 5000, 5000, 10_000] },
    )
    .toMatch(/^(pending_review|completed)$/i);

  const pipelineRes = await request.get(`${API_URL}/api/pipelines/${pipelineId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pipeline = (await pipelineRes.json()) as {
    status: string;
    error?: string | null;
    videos?: Array<{ id: string; reviewStatus: string }>;
  };

  let video =
    pipeline.videos?.find((v) => v.reviewStatus === 'pending') ??
    pipeline.videos?.[0] ??
    null;

  if (!video) {
    const pendingVideos = await apiJson<Array<{ id: string; pipelineRunId: string; reviewStatus: string }>>(
      request,
      token,
      '/api/videos?reviewStatus=pending',
    );
    video = pendingVideos.find((v) => v.pipelineRunId === pipelineId) ?? pendingVideos[0] ?? null;
  }

  expect(video, 'Debe existir un vídeo asociado al pipeline').toBeTruthy();

  // Si el canal publica sin revisión, el flujo de schedule no aplica.
  if (video!.reviewStatus !== 'pending') {
    expect(['approved', 'scheduled', 'published']).toContain(video!.reviewStatus);
    return;
  }

  await page.goto(`/videos/${video!.id}`);
  await expect(page.getByText(/Revisión|Review/i)).toBeVisible();

  await page.getByTestId('review-approve-open').click();
  await expect(page.getByRole('heading', { name: /Programar publicación|Schedule publish/i })).toBeVisible();

  await page.getByRole('radio', { name: /Elegir fecha manual|Choose manual date/i }).check();
  await page.getByTestId('schedule-confirm').click();

  await expect
    .poll(
      async () => {
        const scheduled = await apiJson<Array<{ id: string }>>(request, token, '/api/videos?reviewStatus=scheduled');
        return scheduled.some((v) => v.id === video!.id);
      },
      { timeout: 60_000, intervals: [1000, 2000, 5000] },
    )
    .toBe(true);
});

