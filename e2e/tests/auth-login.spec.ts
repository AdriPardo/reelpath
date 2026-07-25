import { test, expect } from '@playwright/test';

function uniqueEmail(prefix = 'e2e') {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

test('auth: registro -> logout -> login', async ({ page }) => {
  const email = uniqueEmail('auth');
  const password = 'password-e2e-123';

  await page.goto('/register');
  await page.getByTestId('register-name').fill('E2E');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill(password);
  await page.getByTestId('register-submit').click();

  // Si el registro está deshabilitado (instancia ya inicializada), usar credenciales admin de seed.
  if (await page.getByRole('alert').isVisible().catch(() => false)) {
    const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@reelpath.local';
    const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'changeme';
    await page.goto('/login');
    await page.getByTestId('login-email').fill(adminEmail);
    await page.getByTestId('login-password').fill(adminPassword);
    await page.getByTestId('login-submit').click();
  }

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio/ })).toBeVisible();

  await page.getByTestId('nav-logout').click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio/ })).toBeVisible();
});

