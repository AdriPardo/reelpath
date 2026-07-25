import type { Page, APIRequestContext } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const AUTH_COOKIE = 'reelpath_token';
const LEGACY_AUTH_COOKIE = 'autotube_token';

export async function registerViaApi(
  request: APIRequestContext,
  params: { email: string; password: string; name?: string },
): Promise<{ token: string }> {
  const res = await request.post(`${API_URL}/api/auth/register`, {
    data: { email: params.email, password: params.password, name: params.name },
  });
  const text = await res.text();
  if (!res.ok()) {
    throw new Error(`registerViaApi failed (${res.status()}): ${text}`);
  }
  const data = JSON.parse(text) as { token: string };
  if (!data?.token) throw new Error('registerViaApi: token missing');
  return { token: data.token };
}

export async function registerViaApiWithToken(
  request: APIRequestContext,
  adminToken: string,
  params: { email: string; password: string; name?: string },
): Promise<{ token: string }> {
  const res = await request.post(`${API_URL}/api/auth/register`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: params.email, password: params.password, name: params.name },
  });
  const text = await res.text();
  if (!res.ok()) {
    throw new Error(`registerViaApiWithToken failed (${res.status()}): ${text}`);
  }
  const data = JSON.parse(text) as { token: string };
  if (!data?.token) throw new Error('registerViaApiWithToken: token missing');
  return { token: data.token };
}

export async function ensureSessionViaApi(
  request: APIRequestContext,
  params: { email: string; password: string; name?: string },
): Promise<{ token: string; mode: 'registered' | 'admin_login' }> {
  try {
    const { token } = await registerViaApi(request, params);
    return { token, mode: 'registered' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/Registro deshabilitado/i.test(message)) throw err;

    const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@reelpath.local';
    const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'changeme';
    const { token } = await loginViaApi(request, { email: adminEmail, password: adminPassword });
    return { token, mode: 'admin_login' };
  }
}

export async function loginViaApi(
  request: APIRequestContext,
  params: { email: string; password: string },
): Promise<{ token: string }> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: params.email, password: params.password },
  });
  const text = await res.text();
  if (!res.ok()) {
    throw new Error(`loginViaApi failed (${res.status()}): ${text}`);
  }
  const data = JSON.parse(text) as { token: string };
  if (!data?.token) throw new Error('loginViaApi: token missing');
  return { token: data.token };
}

export async function setSessionToken(page: Page, token: string): Promise<void> {
  const context = page.context();
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  await context.addCookies([
    { name: AUTH_COOKIE, value: token, url: baseURL },
    { name: LEGACY_AUTH_COOKIE, value: token, url: baseURL },
  ]);

  await page.addInitScript(
    ([t, key1, key2]) => {
      localStorage.setItem(key1, t);
      localStorage.setItem(key2, t);
      document.cookie = `${key1}=${encodeURIComponent(t)}; path=/; SameSite=Lax`;
      document.cookie = `${key2}=${encodeURIComponent(t)}; path=/; SameSite=Lax`;
    },
    [token, AUTH_COOKIE, LEGACY_AUTH_COOKIE],
  );
}

