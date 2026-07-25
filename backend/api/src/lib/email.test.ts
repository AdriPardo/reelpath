import { describe, expect, it, vi } from 'vitest';
import {
  buildOrgInviteEmail,
  buildPaymentFailedEmail,
  buildPipelineCompletedEmail,
  buildPipelineFailedEmail,
  buildTrialEndingEmail,
  buildWelcomeEmail,
  sendEmail,
} from '@autotube/config';

describe('email templates', () => {
  it('genera asunto de pipeline completado', () => {
    const mail = buildPipelineCompletedEmail({
      userName: 'Ana',
      channelName: 'Historia',
      videoTitle: 'El misterio del templo',
      reviewUrl: 'http://localhost:3000/videos/1',
    });
    expect(mail.subject).toContain('El misterio del templo');
    expect(mail.text).toContain('Ana');
  });

  it('genera aviso de trial', () => {
    const mail = buildTrialEndingEmail({
      userName: null,
      daysLeft: 3,
      billingUrl: 'http://localhost:3000/settings?tab=plan',
    });
    expect(mail.subject).toContain('3 días');
  });

  it('genera aviso de pago fallido', () => {
    const mail = buildPaymentFailedEmail({
      userName: 'Luis',
      billingUrl: 'http://localhost:3000/settings?tab=plan',
    });
    expect(mail.subject).toContain('pago');
    expect(mail.html).toContain('facturación');
  });

  it('genera invitación de equipo', () => {
    const mail = buildOrgInviteEmail({
      organizationName: 'Mi canal',
      inviteUrl: 'http://localhost:3000/invite/abc',
      inviterName: 'Ana',
    });
    expect(mail.subject).toContain('Mi canal');
    expect(mail.html).toContain('abc');
  });

  it('genera email de bienvenida', () => {
    const mail = buildWelcomeEmail({
      userName: 'Ana',
      dashboardUrl: 'http://localhost:3000/',
    });
    expect(mail.subject).toContain('Bienvenido');
    expect(mail.text).toContain('Ana');
  });

  it('genera email de pipeline fallido', () => {
    const mail = buildPipelineFailedEmail({
      userName: 'Luis',
      channelName: 'Historia',
      error: 'Timeout en render',
      pipelineUrl: 'http://localhost:3000/pipelines/1',
    });
    expect(mail.subject).toContain('Historia');
    expect(mail.html).toContain('Timeout');
  });
});

describe('sendEmail stub', () => {
  it('loguea cuando no hay email configurado', async () => {
    const envBackup = {
      BREVO_API_KEY: process.env.BREVO_API_KEY,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
    };
    delete process.env.BREVO_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hola</p>',
      templateId: 'pipeline_completed',
    });

    expect(result.sent).toBe(false);
    expect(result.provider).toBe('stub');
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
    if (envBackup.BREVO_API_KEY) process.env.BREVO_API_KEY = envBackup.BREVO_API_KEY;
    if (envBackup.SMTP_HOST) process.env.SMTP_HOST = envBackup.SMTP_HOST;
    if (envBackup.SMTP_USER) process.env.SMTP_USER = envBackup.SMTP_USER;
    if (envBackup.SMTP_PASS) process.env.SMTP_PASS = envBackup.SMTP_PASS;
  });
});
