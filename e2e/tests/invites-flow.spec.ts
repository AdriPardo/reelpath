import { test, expect } from '@playwright/test';
import { ensureSessionViaApi, registerViaApiWithToken } from '../helpers/auth';

function uniqueEmail(prefix = 'e2e') {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

const API_URL = process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

test('invites: crear invitación y aceptar', async ({ page, request }) => {
  // Owner (crea org)
  const ownerEmail = uniqueEmail('owner');
  const ownerPassword = 'password-e2e-123';
  const ownerSession = await ensureSessionViaApi(request, {
    email: ownerEmail,
    password: ownerPassword,
    name: 'Owner E2E',
  });
  const ownerToken = ownerSession.token;

  // Crear invitación
  const invitedEmail = uniqueEmail('invited');
  const inviteRes = await request.post(`${API_URL}/api/org/invites`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: { email: invitedEmail, role: 'member' },
  });
  const inviteText = await inviteRes.text();
  expect(inviteRes.ok(), `Invitación falló: ${inviteText}`).toBeTruthy();
  const invite = JSON.parse(inviteText) as { inviteUrl?: string; message?: string };
  expect(invite.inviteUrl, 'El backend debe exponer inviteUrl en modo E2E').toBeTruthy();

  const inviteUrl = invite.inviteUrl!;

  // Abrir invitación sin sesión
  await page.goto(inviteUrl);
  await expect(
    page.getByRole('heading', { name: /Invitación al equipo|Team invitation/i }),
  ).toBeVisible({ timeout: 20_000 });

  // Crear cuenta con el mismo email
  const invitedPassword = 'password-e2e-456';
  if (ownerSession.mode === 'registered') {
    await page.getByRole('link', { name: /Crear cuenta|Create account/i }).click();
    await expect(page).toHaveURL(/\/(?:en|es)\/register/);

    await page.getByTestId('register-name').fill('Invitado');
    await page.getByTestId('register-email').fill(invitedEmail);
    await page.getByTestId('register-password').fill(invitedPassword);
    await page.getByTestId('register-submit').click();
    await expect(page).toHaveURL(/\/(?:en|es)\/?$/, { timeout: 30_000 });
  } else {
    await registerViaApiWithToken(request, ownerToken, {
      email: invitedEmail,
      password: invitedPassword,
      name: 'Invitado',
    });

    await page.getByRole('link', { name: /Iniciar sesión|Sign in/i }).click();
    await expect(page).toHaveURL(/\/(?:en|es)\/login/);
    await page.getByTestId('login-email').fill(invitedEmail);
    await page.getByTestId('login-password').fill(invitedPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/(?:en|es)\/?$/, { timeout: 30_000 });
  }

  // Volver a la URL de invitación ya con sesión: se acepta y redirige a ajustes.
  await page.goto(inviteUrl);
  await expect(page.getByText(/Procesando invitación|Processing invitation/i)).toBeVisible();
  await expect(page).toHaveURL(/\/(?:en|es)\/settings/, { timeout: 30_000 });
});

