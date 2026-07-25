import { test, expect } from '@playwright/test';
import { registerViaApi, loginViaApi, setSessionToken } from '../helpers/auth';

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

  await expect(page).toHaveURL(homeUrl);
  await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio|Hi,|Dashboard/ })).toBeVisible();

  await page.getByTestId('nav-logout').click();
  await expect(page).toHaveURL(loginUrl);

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(homeUrl);
  await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio|Hi,|Dashboard/ })).toBeVisible();
});

test('auth: UI register flow', async ({ page }) => {
  const email = uniqueEmail('uireg');
  const password = 'password-e2e-123';

  await page.goto('/register');
  await page.getByTestId('register-name').fill('E2E UI');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill(password);
  await page.getByTestId('register-submit').click();

  await expect(page).toHaveURL(homeUrl, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio|Hi,|Dashboard/ })).toBeVisible();
});
