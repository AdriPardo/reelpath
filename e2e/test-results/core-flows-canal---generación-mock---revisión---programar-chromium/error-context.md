# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-flows.spec.ts >> canal -> generación (mock) -> revisión -> programar
- Location: e2e/tests/core-flows.spec.ts:19:5

# Error details

```
Error: browserContext.addCookies: Cookie should have a url or a domain/path pair
```

# Test source

```ts
  1  | import type { Page, APIRequestContext } from '@playwright/test';
  2  | 
  3  | const API_URL = process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  4  | const AUTH_COOKIE = 'reelpath_token';
  5  | const LEGACY_AUTH_COOKIE = 'autotube_token';
  6  | 
  7  | export async function registerViaApi(
  8  |   request: APIRequestContext,
  9  |   params: { email: string; password: string; name?: string },
  10 | ): Promise<{ token: string }> {
  11 |   const res = await request.post(`${API_URL}/api/auth/register`, {
  12 |     data: { email: params.email, password: params.password, name: params.name },
  13 |   });
  14 |   const text = await res.text();
  15 |   if (!res.ok()) {
  16 |     throw new Error(`registerViaApi failed (${res.status()}): ${text}`);
  17 |   }
  18 |   const data = JSON.parse(text) as { token: string };
  19 |   if (!data?.token) throw new Error('registerViaApi: token missing');
  20 |   return { token: data.token };
  21 | }
  22 | 
  23 | export async function registerViaApiWithToken(
  24 |   request: APIRequestContext,
  25 |   adminToken: string,
  26 |   params: { email: string; password: string; name?: string },
  27 | ): Promise<{ token: string }> {
  28 |   const res = await request.post(`${API_URL}/api/auth/register`, {
  29 |     headers: { Authorization: `Bearer ${adminToken}` },
  30 |     data: { email: params.email, password: params.password, name: params.name },
  31 |   });
  32 |   const text = await res.text();
  33 |   if (!res.ok()) {
  34 |     throw new Error(`registerViaApiWithToken failed (${res.status()}): ${text}`);
  35 |   }
  36 |   const data = JSON.parse(text) as { token: string };
  37 |   if (!data?.token) throw new Error('registerViaApiWithToken: token missing');
  38 |   return { token: data.token };
  39 | }
  40 | 
  41 | export async function ensureSessionViaApi(
  42 |   request: APIRequestContext,
  43 |   params: { email: string; password: string; name?: string },
  44 | ): Promise<{ token: string; mode: 'registered' | 'admin_login' }> {
  45 |   try {
  46 |     const { token } = await registerViaApi(request, params);
  47 |     return { token, mode: 'registered' };
  48 |   } catch (err) {
  49 |     const message = err instanceof Error ? err.message : String(err);
  50 |     if (!/Registro deshabilitado/i.test(message)) throw err;
  51 | 
  52 |     const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@reelpath.local';
  53 |     const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'changeme';
  54 |     const { token } = await loginViaApi(request, { email: adminEmail, password: adminPassword });
  55 |     return { token, mode: 'admin_login' };
  56 |   }
  57 | }
  58 | 
  59 | export async function loginViaApi(
  60 |   request: APIRequestContext,
  61 |   params: { email: string; password: string },
  62 | ): Promise<{ token: string }> {
  63 |   const res = await request.post(`${API_URL}/api/auth/login`, {
  64 |     data: { email: params.email, password: params.password },
  65 |   });
  66 |   const text = await res.text();
  67 |   if (!res.ok()) {
  68 |     throw new Error(`loginViaApi failed (${res.status()}): ${text}`);
  69 |   }
  70 |   const data = JSON.parse(text) as { token: string };
  71 |   if (!data?.token) throw new Error('loginViaApi: token missing');
  72 |   return { token: data.token };
  73 | }
  74 | 
  75 | export async function setSessionToken(page: Page, token: string): Promise<void> {
  76 |   const context = page.context();
  77 |   const url = new URL(page.url() || 'http://localhost:3000');
  78 |   const domain = url.hostname;
  79 | 
> 80 |   await context.addCookies([
     |                 ^ Error: browserContext.addCookies: Cookie should have a url or a domain/path pair
  81 |     { name: AUTH_COOKIE, value: token, path: '/', domain },
  82 |     { name: LEGACY_AUTH_COOKIE, value: token, path: '/', domain },
  83 |   ]);
  84 | 
  85 |   await page.addInitScript(
  86 |     ([t, key1, key2]) => {
  87 |       localStorage.setItem(key1, t);
  88 |       localStorage.setItem(key2, t);
  89 |       document.cookie = `${key1}=${encodeURIComponent(t)}; path=/; SameSite=Lax`;
  90 |       document.cookie = `${key2}=${encodeURIComponent(t)}; path=/; SameSite=Lax`;
  91 |     },
  92 |     [token, AUTH_COOKIE, LEGACY_AUTH_COOKIE],
  93 |   );
  94 | }
  95 | 
  96 | 
```