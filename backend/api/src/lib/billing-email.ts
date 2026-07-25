import {
  buildPaymentFailedEmail,
  buildTrialEndingEmail,
  loadConfig,
  sendEmail,
} from '@autotube/config';
import { prisma } from '@autotube/database';
import type { ApiLocale } from './i18n.js';

const trialReminderSent = new Set<string>();

function normalizeEmailLocale(locale: string | null | undefined): ApiLocale {
  return locale === 'en' ? 'en' : 'es';
}

export async function maybeSendTrialEndingEmail(options: {
  organizationId: string;
  userEmail: string;
  userName: string | null;
  userLocale?: string | null;
  trialEndsAt: Date | null;
  plan: string;
}): Promise<void> {
  if (options.plan !== 'trial' || !options.trialEndsAt) return;

  const msLeft = options.trialEndsAt.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0 || daysLeft > 3) return;

  const dedupeKey = `${options.organizationId}:${options.trialEndsAt.toISOString().slice(0, 10)}`;
  if (trialReminderSent.has(dedupeKey)) return;
  trialReminderSent.add(dedupeKey);

  const config = loadConfig();
  const locale = normalizeEmailLocale(options.userLocale);
  const billingUrl = `${config.FRONTEND_URL}/${locale}/settings?tab=plan`;
  const content = buildTrialEndingEmail({
    userName: options.userName,
    daysLeft,
    billingUrl,
    locale,
  });

  await sendEmail({
    to: options.userEmail,
    templateId: 'trial_ending',
    ...content,
  });
}

export async function notifyPaymentFailed(orgId: string): Promise<void> {
  const owner = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, role: 'owner' },
    include: { user: { select: { email: true, name: true, locale: true } } },
  });

  if (!owner?.user.email) return;

  const config = loadConfig();
  const locale = normalizeEmailLocale(owner.user.locale);
  const content = buildPaymentFailedEmail({
    userName: owner.user.name,
    billingUrl: `${config.FRONTEND_URL}/${locale}/settings?tab=plan`,
    locale,
  });

  await sendEmail({
    to: owner.user.email,
    templateId: 'payment_failed',
    ...content,
  });
}
