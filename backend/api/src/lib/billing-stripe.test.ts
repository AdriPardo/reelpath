import { describe, expect, it, vi } from 'vitest';
import {
  claimWebhookEvent,
  mapStripeSubscriptionStatus,
  resolvePlanChangeAction,
  type PaidPlanId,
} from './billing-stripe.js';

describe('resolvePlanChangeAction', () => {
  const targetPriceId = 'price_pro';

  it('devuelve same_plan si ya tiene el mismo plan activo', () => {
    const result = resolvePlanChangeAction({
      hasActiveSubscription: true,
      currentPlanId: 'pro',
      targetPlanId: 'pro',
      stripeSubscriptionId: 'sub_123',
      targetPriceId,
    });
    expect(result).toEqual({ action: 'same_plan', message: 'Ya tienes este plan' });
  });

  it('devuelve change_plan si hay suscripción activa a otro plan', () => {
    const result = resolvePlanChangeAction({
      hasActiveSubscription: true,
      currentPlanId: 'starter',
      targetPlanId: 'pro' as PaidPlanId,
      stripeSubscriptionId: 'sub_123',
      targetPriceId,
    });
    expect(result).toEqual({
      action: 'change_plan',
      subscriptionId: 'sub_123',
      newPriceId: targetPriceId,
    });
  });

  it('devuelve checkout si no hay suscripción activa', () => {
    const result = resolvePlanChangeAction({
      hasActiveSubscription: false,
      currentPlanId: 'trial',
      targetPlanId: 'starter',
      stripeSubscriptionId: null,
      targetPriceId: 'price_starter',
    });
    expect(result).toEqual({ action: 'checkout', priceId: 'price_starter' });
  });

  it('usa checkout si hay suscripción activa pero falta stripeSubscriptionId', () => {
    const result = resolvePlanChangeAction({
      hasActiveSubscription: true,
      currentPlanId: 'starter',
      targetPlanId: 'pro',
      stripeSubscriptionId: null,
      targetPriceId,
    });
    expect(result).toEqual({ action: 'checkout', priceId: targetPriceId });
  });
});

describe('mapStripeSubscriptionStatus', () => {
  it('mapea estados activos', () => {
    expect(mapStripeSubscriptionStatus('active')).toBe('active');
    expect(mapStripeSubscriptionStatus('trialing')).toBe('active');
  });

  it('mapea past_due', () => {
    expect(mapStripeSubscriptionStatus('past_due')).toBe('past_due');
  });

  it('mapea estados cancelados', () => {
    expect(mapStripeSubscriptionStatus('canceled')).toBe('canceled');
    expect(mapStripeSubscriptionStatus('unpaid')).toBe('canceled');
  });

  it('devuelve null para estados desconocidos', () => {
    expect(mapStripeSubscriptionStatus('incomplete')).toBeNull();
  });
});

describe('claimWebhookEvent', () => {
  it('devuelve true la primera vez y false si ya existe', async () => {
    const store = {
      create: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({ code: 'P2002' }),
    };

    await expect(claimWebhookEvent('evt_1', store)).resolves.toBe(true);
    await expect(claimWebhookEvent('evt_1', store)).resolves.toBe(false);
    expect(store.create).toHaveBeenCalledTimes(2);
  });
});
