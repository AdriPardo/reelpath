# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: invites-flow.spec.ts >> invites: crear invitación y aceptar
- Location: e2e/tests/invites-flow.spec.ts:10:5

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://localhost:3000/invite/849f01852e8da1bcc56edde9246b68ddf4446a99d1b2a12937bd7b8ceb020d75
Call log:
  - navigating to "http://localhost:3000/invite/849f01852e8da1bcc56edde9246b68ddf4446a99d1b2a12937bd7b8ceb020d75", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { ensureSessionViaApi, registerViaApiWithToken } from '../helpers/auth';
  3  | 
  4  | function uniqueEmail(prefix = 'e2e') {
  5  |   return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
  6  | }
  7  | 
  8  | const API_URL = process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  9  | 
  10 | test('invites: crear invitación y aceptar', async ({ page, request }) => {
  11 |   // Owner (crea org)
  12 |   const ownerEmail = uniqueEmail('owner');
  13 |   const ownerPassword = 'password-e2e-123';
  14 |   const ownerSession = await ensureSessionViaApi(request, {
  15 |     email: ownerEmail,
  16 |     password: ownerPassword,
  17 |     name: 'Owner E2E',
  18 |   });
  19 |   const ownerToken = ownerSession.token;
  20 | 
  21 |   // Crear invitación
  22 |   const invitedEmail = uniqueEmail('invited');
  23 |   const inviteRes = await request.post(`${API_URL}/api/org/invites`, {
  24 |     headers: { Authorization: `Bearer ${ownerToken}` },
  25 |     data: { email: invitedEmail, role: 'member' },
  26 |   });
  27 |   const inviteText = await inviteRes.text();
  28 |   expect(inviteRes.ok(), `Invitación falló: ${inviteText}`).toBeTruthy();
  29 |   const invite = JSON.parse(inviteText) as { inviteUrl?: string; message?: string };
  30 |   expect(invite.inviteUrl, 'El backend debe exponer inviteUrl en modo E2E').toBeTruthy();
  31 | 
  32 |   const inviteUrl = invite.inviteUrl!;
  33 | 
  34 |   // Abrir invitación sin sesión
> 35 |   await page.goto(inviteUrl);
     |              ^ Error: page.goto: net::ERR_ABORTED at http://localhost:3000/invite/849f01852e8da1bcc56edde9246b68ddf4446a99d1b2a12937bd7b8ceb020d75
  36 |   await expect(page.getByRole('heading', { name: 'Invitación al equipo' })).toBeVisible();
  37 | 
  38 |   // Crear cuenta con el mismo email
  39 |   const invitedPassword = 'password-e2e-456';
  40 |   if (ownerSession.mode === 'registered') {
  41 |     await page.getByRole('link', { name: 'Crear cuenta' }).click();
  42 |     await expect(page).toHaveURL(/\/register/);
  43 | 
  44 |     await page.getByTestId('register-name').fill('Invitado');
  45 |     await page.getByTestId('register-email').fill(invitedEmail);
  46 |     await page.getByTestId('register-password').fill(invitedPassword);
  47 |     await page.getByTestId('register-submit').click();
  48 |     await expect(page).toHaveURL(/\/$/);
  49 |   } else {
  50 |     // Si el registro público está deshabilitado, crear el usuario invitado vía API usando token admin/owner.
  51 |     await registerViaApiWithToken(request, ownerToken, {
  52 |       email: invitedEmail,
  53 |       password: invitedPassword,
  54 |       name: 'Invitado',
  55 |     });
  56 | 
  57 |     await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  58 |     await expect(page).toHaveURL(/\/login/);
  59 |     await page.getByTestId('login-email').fill(invitedEmail);
  60 |     await page.getByTestId('login-password').fill(invitedPassword);
  61 |     await page.getByTestId('login-submit').click();
  62 |     await expect(page).toHaveURL(/\/$/);
  63 |   }
  64 | 
  65 |   // Volver a la URL de invitación ya con sesión: se acepta y redirige a ajustes.
  66 |   await page.goto(inviteUrl);
  67 |   await expect(page.getByText('Procesando invitación…')).toBeVisible();
  68 |   await expect(page).toHaveURL(/\/settings\?tab=team/, { timeout: 30_000 });
  69 | });
  70 | 
  71 | 
```