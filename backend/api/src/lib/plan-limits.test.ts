import { describe, expect, it } from 'vitest';
import {
  isTrialExpired,
  trialDaysRemaining,
} from './plan-limits.js';

describe('isTrialExpired', () => {
  it('devuelve false si no es plan trial', () => {
    expect(isTrialExpired('starter', new Date(0))).toBe(false);
  });

  it('devuelve false si trialEndsAt es futuro', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(isTrialExpired('trial', future)).toBe(false);
  });

  it('devuelve true si trialEndsAt pasó', () => {
    const past = new Date(Date.now() - 1000);
    expect(isTrialExpired('trial', past)).toBe(true);
  });
});

describe('trialDaysRemaining', () => {
  it('devuelve null sin fecha', () => {
    expect(trialDaysRemaining(null)).toBeNull();
    expect(trialDaysRemaining(undefined)).toBeNull();
  });

  it('devuelve 0 si expiró', () => {
    expect(trialDaysRemaining(new Date(Date.now() - 60_000))).toBe(0);
  });

  it('redondea hacia arriba días restantes', () => {
    const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 1000);
    expect(trialDaysRemaining(inTwoDays)).toBe(2);
  });
});
