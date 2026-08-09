import { describe, expect, it } from 'vitest';
import { nextRotatedSecret, parseSecretKeyList, resetSecretRotation } from './rotate-secret.js';

describe('rotate-secret', () => {
  it('parsea lista comma/semicolon', () => {
    expect(parseSecretKeyList('a, b;c')).toEqual(['a', 'b', 'c']);
  });

  it('rota round-robin', () => {
    resetSecretRotation('test');
    expect(nextRotatedSecret('test', 'k1,k2,k3')).toBe('k1');
    expect(nextRotatedSecret('test', 'k1,k2,k3')).toBe('k2');
    expect(nextRotatedSecret('test', 'k1,k2,k3')).toBe('k3');
    expect(nextRotatedSecret('test', 'k1,k2,k3')).toBe('k1');
  });
});
