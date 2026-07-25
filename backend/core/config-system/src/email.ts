import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { loadConfig } from './index.js';

export type EmailTemplateId =
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'trial_ending'
  | 'payment_failed'
  | 'org_invite'
  | 'welcome';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: EmailTemplateId;
}

export interface SendEmailResult {
  sent: boolean;
  provider: 'brevo' | 'smtp' | 'stub';
  messageId?: string;
}

function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  return Boolean(host && user && pass);
}

export function isEmailConfigured(): boolean {
  return isBrevoConfigured() || isSmtpConfigured();
}

function parseEmailFrom(from: string): { email: string; name?: string } {
  const trimmed = from.trim();
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, '');
    return { name: name || undefined, email: match[2].trim() };
  }
  return { email: trimmed };
}

let cachedTransporter: Transporter | null = null;

function getSmtpTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!.trim(),
    },
  });

  return cachedTransporter;
}

async function sendViaSmtp(params: SendEmailParams): Promise<SendEmailResult> {
  const config = loadConfig();
  const info = await getSmtpTransporter().sendMail({
    from: config.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  return { sent: true, provider: 'smtp', messageId: info.messageId };
}

async function sendViaBrevo(params: SendEmailParams): Promise<SendEmailResult> {
  const config = loadConfig();
  const payload: Record<string, unknown> = {
    sender: parseEmailFrom(config.EMAIL_FROM),
    to: [{ email: params.to }],
    subject: params.subject,
    htmlContent: params.html,
  };
  if (params.text) {
    payload.textContent = params.text;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as { messageId?: string };
  return { sent: true, provider: 'brevo', messageId: data.messageId };
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (isBrevoConfigured()) {
    return sendViaBrevo(params);
  }

  if (isSmtpConfigured()) {
    return sendViaSmtp(params);
  }

  console.info(
    JSON.stringify({
      event: 'email.stub',
      templateId: params.templateId ?? null,
      to: params.to,
      subject: params.subject,
      preview: params.text ?? params.subject,
      hint: 'Configura BREVO_API_KEY o SMTP_HOST, SMTP_USER y SMTP_PASS para enviar correos reales',
    }),
  );
  return { sent: false, provider: 'stub' };
}

export type EmailLocale = 'es' | 'en';

function emailGreeting(userName: string | null | undefined, locale: EmailLocale): string {
  if (userName?.trim()) {
    return locale === 'en' ? `Hi ${userName.trim()},` : `Hola ${userName.trim()},`;
  }
  return locale === 'en' ? 'Hi,' : 'Hola,';
}

export function buildPipelineCompletedEmail(options: {
  userName: string | null;
  channelName: string;
  videoTitle: string;
  reviewUrl: string;
  locale?: EmailLocale;
}): Pick<SendEmailParams, 'subject' | 'html' | 'text'> {
  const locale = options.locale ?? 'es';
  const greeting = emailGreeting(options.userName, locale);
  const subject =
    locale === 'en'
      ? `Your video «${options.videoTitle}» is ready for review`
      : `Tu vídeo «${options.videoTitle}» está listo para revisar`;
  const body =
    locale === 'en'
      ? `Generation on «${options.channelName}» has finished.`
      : `La generación en «${options.channelName}» ha terminado.`;
  const cta = locale === 'en' ? 'Review video' : 'Revisar vídeo';
  const text = `${greeting}\n\n${body}\nVideo: ${options.videoTitle}\n${cta}: ${options.reviewUrl}`;
  const html = `<p>${greeting}</p><p>${body}</p><p><strong>${options.videoTitle}</strong></p><p><a href="${options.reviewUrl}">${cta}</a></p>`;
  return { subject, html, text };
}

export function buildTrialEndingEmail(options: {
  userName: string | null;
  daysLeft: number;
  billingUrl: string;
  locale?: EmailLocale;
}): Pick<SendEmailParams, 'subject' | 'html' | 'text'> {
  const locale = options.locale ?? 'es';
  const greeting = emailGreeting(options.userName, locale);
  const subject =
    locale === 'en'
      ? `Your Reelpath trial ends in ${options.daysLeft} day${options.daysLeft === 1 ? '' : 's'}`
      : `Tu prueba de Reelpath termina en ${options.daysLeft} día${options.daysLeft === 1 ? '' : 's'}`;
  const body =
    locale === 'en'
      ? `You have ${options.daysLeft} days left on your free Reelpath trial.`
      : `Te quedan ${options.daysLeft} días de prueba gratuita en Reelpath.`;
  const cta = locale === 'en' ? 'View plans and billing' : 'Ver planes y facturación';
  const text = `${greeting}\n\n${body}\n${cta}: ${options.billingUrl}`;
  const html = `<p>${greeting}</p><p>${body}</p><p><a href="${options.billingUrl}">${cta}</a></p>`;
  return { subject, html, text };
}

export function buildPaymentFailedEmail(options: {
  userName: string | null;
  billingUrl: string;
  locale?: EmailLocale;
}): Pick<SendEmailParams, 'subject' | 'html' | 'text'> {
  const locale = options.locale ?? 'es';
  const greeting = emailGreeting(options.userName, locale);
  const subject =
    locale === 'en'
      ? 'Action required: payment issue on Reelpath'
      : 'Acción requerida: problema con tu pago en Reelpath';
  const body =
    locale === 'en'
      ? 'We couldn\'t charge your subscription. Update your payment method to keep generating videos.'
      : 'No hemos podido cobrar tu suscripción. Actualiza el método de pago para seguir generando vídeos.';
  const cta = locale === 'en' ? 'Go to billing' : 'Ir a facturación';
  const text = `${greeting}\n\n${body} ${options.billingUrl}`;
  const html = `<p>${greeting}</p><p>${body}</p><p><a href="${options.billingUrl}">${cta}</a></p>`;
  return { subject, html, text };
}

export function buildOrgInviteEmail(options: {
  organizationName: string;
  inviteUrl: string;
  inviterName: string | null;
  locale?: EmailLocale;
}): Pick<SendEmailParams, 'subject' | 'html' | 'text'> {
  const locale = options.locale ?? 'es';
  const inviter =
    options.inviterName?.trim() ||
    (locale === 'en' ? 'An administrator' : 'Un administrador');
  const subject =
    locale === 'en'
      ? `Invitation to join «${options.organizationName}» on Reelpath`
      : `Invitación a unirte a «${options.organizationName}» en Reelpath`;
  const body =
    locale === 'en'
      ? `${inviter} invited you to collaborate on ${options.organizationName} on Reelpath.`
      : `${inviter} te ha invitado a colaborar en «${options.organizationName}» en Reelpath.`;
  const cta = locale === 'en' ? 'Accept invitation' : 'Aceptar invitación';
  const text = `${body}\n${cta}: ${options.inviteUrl}`;
  const html = `<p>${body}</p><p><a href="${options.inviteUrl}">${cta}</a></p>`;
  return { subject, html, text };
}

export function buildWelcomeEmail(options: {
  userName: string | null;
  dashboardUrl: string;
  locale?: EmailLocale;
}): Pick<SendEmailParams, 'subject' | 'html' | 'text'> {
  const locale = options.locale ?? 'es';
  const greeting = emailGreeting(options.userName, locale);
  const subject = locale === 'en' ? 'Welcome to Reelpath' : 'Bienvenido a Reelpath';
  const body =
    locale === 'en'
      ? 'Your account is ready. Create a channel, connect YouTube, and launch your first generation.'
      : 'Tu cuenta está lista. Crea un canal, conecta YouTube y lanza tu primera generación.';
  const cta = locale === 'en' ? 'Go to dashboard' : 'Ir al panel';
  const text = `${greeting}\n\n${body}\n\n${cta}: ${options.dashboardUrl}`;
  const html = `<p>${greeting}</p><p>${body}</p><p><a href="${options.dashboardUrl}">${cta}</a></p>`;
  return { subject, html, text };
}

export function buildPipelineFailedEmail(options: {
  userName: string | null;
  channelName: string;
  error: string;
  pipelineUrl: string;
  locale?: EmailLocale;
}): Pick<SendEmailParams, 'subject' | 'html' | 'text'> {
  const locale = options.locale ?? 'es';
  const greeting = emailGreeting(options.userName, locale);
  const subject =
    locale === 'en'
      ? `Generation failed on «${options.channelName}»`
      : `Generación fallida en «${options.channelName}»`;
  const body =
    locale === 'en'
      ? `Generation on «${options.channelName}» did not complete.`
      : `La generación en «${options.channelName}» no se completó.`;
  const errorLabel = locale === 'en' ? 'Error:' : 'Error:';
  const cta = locale === 'en' ? 'View generation details' : 'Ver detalle de la generación';
  const text = `${greeting}\n\n${body}\n${errorLabel} ${options.error}\n\n${cta}: ${options.pipelineUrl}`;
  const html =
    `<p>${greeting}</p><p>${body}</p><p><strong>${errorLabel}</strong> ${options.error}</p>` +
    `<p><a href="${options.pipelineUrl}">${cta}</a></p>`;
  return { subject, html, text };
}
