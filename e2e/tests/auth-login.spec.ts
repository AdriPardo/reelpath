import { test, expect } from '@playwright/test';
import { registerViaApi } from '../helpers/auth';

function uniqueEmail(prefix = 'e2e') {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

const homeUrl = /\/(?:en|es)\/?$/;
const loginUrl = /\/(?:en|es)\/login/;

test('auth: registro -> logout -> login', async ({ page, request }) => {
  const email = uniqueEmail('auth');
  const password = 'password-e2e-123';

  // Registro vía API (evita carreras de UI / rate-limit entre workers).
  await registerViaApi(request, { email, password, name: 'E2E' });

  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(homeUrl, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio|Hi,|Dashboard/ })).toBeVisible();

  await page.getByTestId('nav-logout').click();
  await expect(page).toHaveURL(loginUrl);

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(homeUrl, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio|Hi,|Dashboard/ })).toBeVisible();
});
