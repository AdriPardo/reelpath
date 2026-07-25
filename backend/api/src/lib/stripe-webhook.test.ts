import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { handleStripeWebhook, verifyStripeSignature } from './stripe-webhook.js';

function signPayload(payload: string, secret: string, timestamp: number): string {
  const signed = `${timestamp}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

describe('verifyStripeSignature', () => {
  it('acepta firma válida', () => {
    const secret = 'whsec_test';
    const payload = '{"id":"evt_1"}';
    const ts = Math.floor(Date.now() / 1000);
    const header = signPayload(payload, secret, ts);
    expect(verifyStripeSignature(Buffer.from(payload), header, secret)).toBe(true);
  });

  it('rechaza firma inválida', () => {
    const payload = '{"id":"evt_1"}';
    expect(verifyStripeSignature(Buffer.from(payload), 't=1,v1=deadbeef', 'whsec_test')).toBe(
      false,
    );
  });
});

describe('handleStripeWebhook idempotencia', () => {
  it('omite eventos ya procesados', async () => {
    const secret = 'whsec_test';
    const payload = JSON.stringify({
      id: 'evt_duplicate',
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_1', subscription: 'sub_1' } },
    });
    const header = signPayload(payload, secret, Math.floor(Date.now() / 1000));
    const claimEvent = vi.fn().mockResolvedValue(false);

    await handleStripeWebhook(Buffer.from(payload), header, {
      webhookSecret: secret,
      claimEvent,
    });

    expect(claimEvent).toHaveBeenCalledWith('evt_duplicate');
    expect(claimEvent).toHaveBeenCalledTimes(1);
  });

  it('procesa eventos nuevos', async () => {
    const secret = 'whsec_test';
    const payload = JSON.stringify({
      id: 'evt_new',
      type: 'unknown.event',
      data: { object: {} },
    });
    const header = signPayload(payload, secret, Math.floor(Date.now() / 1000));
    const claimEvent = vi.fn().mockResolvedValue(true);

    await expect(
      handleStripeWebhook(Buffer.from(payload), header, {
        webhookSecret: secret,
        claimEvent,
      }),
    ).resolves.toBeUndefined();

    expect(claimEvent).toHaveBeenCalledWith('evt_new');
  });
});
