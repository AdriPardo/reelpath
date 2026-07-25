import type { Request, Response } from 'express';
import { handleStripeWebhook } from '../lib/stripe-webhook.js';

export async function billingWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const signature = req.headers['stripe-signature'];
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    await handleStripeWebhook(payload, typeof signature === 'string' ? signature : undefined);
    res.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en webhook';
    const status = message.includes('inválida') ? 400 : 500;
    console.error('[billing/webhook]', message);
    res.status(status).json({ error: message });
  }
}
