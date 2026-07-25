import { test, expect } from '@playwright/test';
import { ensureSessionViaApi, setSessionToken } from '../helpers/auth';

function uniqueEmail(prefix = 'e2e') {
  return `${prefix}.${Date.now()}.${Math.random().toString(16).slice(2)}@example.com`;
}

test('billing: cambio de plan muestra error si Stripe no está configurado', async ({ page, request }) => {
  const email = uniqueEmail('billing');
  const password = 'password-e2e-123';
  const { token } = await ensureSessionViaApi(request, { email, password, name: 'E2E Billing' });

  await setSessionToken(page, token);
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: /Ajustes|Settings/ })).toBeVisible();

  await page.getByTestId('settings-tab-plan').or(page.getByTestId('settings-tab-side-plan')).first().click();
  await page.getByRole('button', { name: /Ver planes y mejorar|Mejorar plan|View plans and upgrade|Upgrade plan/i }).click();
  await expect(page.getByText(/Planes disponibles|Available plans/i)).toBeVisible();

  const upgrade = page.getByRole('button', { name: /Mejorar a este plan|Upgrade to this plan/i }).first();
  await upgrade.click();

  await expect(page.getByRole('alert')).toContainText(/Stripe|configurad|secret key|facturación|billing/i);
});
