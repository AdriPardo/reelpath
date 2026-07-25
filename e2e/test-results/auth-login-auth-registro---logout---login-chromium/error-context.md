# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-login.spec.ts >> auth: registro -> logout -> login
- Location: e2e/tests/auth-login.spec.ts:7:5

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://localhost:3000/register
Call log:
  - navigating to "http://localhost:3000/register", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | function uniqueEmail(prefix = 'e2e') {
  4  |   return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
  5  | }
  6  | 
  7  | test('auth: registro -> logout -> login', async ({ page }) => {
  8  |   const email = uniqueEmail('auth');
  9  |   const password = 'password-e2e-123';
  10 | 
> 11 |   await page.goto('/register');
     |              ^ Error: page.goto: net::ERR_ABORTED at http://localhost:3000/register
  12 |   await page.getByTestId('register-name').fill('E2E');
  13 |   await page.getByTestId('register-email').fill(email);
  14 |   await page.getByTestId('register-password').fill(password);
  15 |   await page.getByTestId('register-submit').click();
  16 | 
  17 |   // Si el registro está deshabilitado (instancia ya inicializada), usar credenciales admin de seed.
  18 |   if (await page.getByRole('alert').isVisible().catch(() => false)) {
  19 |     const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@reelpath.local';
  20 |     const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'changeme';
  21 |     await page.goto('/login');
  22 |     await page.getByTestId('login-email').fill(adminEmail);
  23 |     await page.getByTestId('login-password').fill(adminPassword);
  24 |     await page.getByTestId('login-submit').click();
  25 |   }
  26 | 
  27 |   await expect(page).toHaveURL(/\/$/);
  28 |   await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio/ })).toBeVisible();
  29 | 
  30 |   await page.getByTestId('nav-logout').click();
  31 |   await expect(page).toHaveURL(/\/login/);
  32 | 
  33 |   await page.getByTestId('login-email').fill(email);
  34 |   await page.getByTestId('login-password').fill(password);
  35 |   await page.getByTestId('login-submit').click();
  36 | 
  37 |   await expect(page).toHaveURL(/\/$/);
  38 |   await expect(page.getByRole('heading', { name: /Hola,|Panel de inicio/ })).toBeVisible();
  39 | });
  40 | 
  41 | 
```