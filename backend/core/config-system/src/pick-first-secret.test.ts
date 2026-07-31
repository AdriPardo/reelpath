import { describe, expect, it } from 'vitest';
import { pickFirstSecret } from './pick-first-secret.js';

describe('pickFirstSecret (Atlas env → PlatformSecret → org leftover)', () => {
  it('prefers env over PlatformSecret and org', () => {
    expect(pickFirstSecret('env-key', 'db-key', 'org-key')).toBe('env-key');
  });

  it('falls back to PlatformSecret when env missing', () => {
    expect(pickFirstSecret(undefined, 'db-key', 'org-key')).toBe('db-key');
    expect(pickFirstSecret('', '  db-key  ', null)).toBe('db-key');
  });

  it('falls back to leftover org BYOK when env and PlatformSecret empty', () => {
    expect(pickFirstSecret(null, undefined, 'org-key')).toBe('org-key');
  });

  it('returns undefined when all empty', () => {
    expect(pickFirstSecret(undefined, null, '  ')).toBeUndefined();
  });
});
