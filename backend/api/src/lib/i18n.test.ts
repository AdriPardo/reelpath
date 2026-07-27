import { describe, expect, it } from 'vitest';
import { t } from './i18n.js';

describe('t()', () => {
  it('traduce con firma t(locale, key)', () => {
    expect(t('es', 'api.errors.orgInactive')).toContain('inactiva');
    expect(t('en', 'api.errors.trialExpired')).toMatch(/trial/i);
  });

  it('interpola params', () => {
    expect(t('es', 'api.errors.videoMonthlyLimit', { limit: 8 })).toContain('8');
  });

  it('corrige args invertidos t(key, locale) en vez de devolver "es"', () => {
    // Bug histórico: plan-limits llamaba t(key, locale) y el toast mostraba solo "es".
    expect(t('api.errors.orgInactive', 'es')).toContain('inactiva');
    expect(t('api.errors.videoMonthlyLimit', 'es', { limit: 8 })).toContain('8');
    expect(t('api.errors.orgInactive', 'es')).not.toBe('es');
  });
});
