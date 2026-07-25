/**
 * Envía un correo de prueba vía Brevo API o SMTP.
 *
 * Uso:
 *   npm run email:test
 *   npm run email:test -- destino@ejemplo.com
 */

import 'dotenv/config';
import { isEmailConfigured, loadConfig, sendEmail } from '@autotube/config';

function resolveRecipient(): string {
  const arg = process.argv[2]?.trim();
  if (arg) return arg.toLowerCase();

  const admin = process.env.DEFAULT_ADMIN_EMAIL?.trim();
  if (admin) return admin.toLowerCase();

  const smtpUser = process.env.SMTP_USER?.trim();
  if (smtpUser?.includes('@')) return smtpUser.toLowerCase();

  throw new Error(
    'Indica destinatario: npm run email:test -- tu@email.com (o define DEFAULT_ADMIN_EMAIL en .env)',
  );
}

function emailVarsStatus(): Record<string, 'SET' | 'EMPTY'> {
  return {
    BREVO_API_KEY: process.env.BREVO_API_KEY?.trim() ? 'SET' : 'EMPTY',
    SMTP_HOST: process.env.SMTP_HOST?.trim() ? 'SET' : 'EMPTY',
    SMTP_USER: process.env.SMTP_USER?.trim() ? 'SET' : 'EMPTY',
    SMTP_PASS: process.env.SMTP_PASS?.trim() ? 'SET' : 'EMPTY',
  };
}

async function main() {
  const vars = emailVarsStatus();
  const useBrevo = vars.BREVO_API_KEY === 'SET';

  if (!isEmailConfigured()) {
    console.error('Email no configurado.');
    console.error('Opción A — Brevo API: define BREVO_API_KEY=xkeysib-... (puedes dejar SMTP vacío)');
    console.error('Opción B — SMTP: define SMTP_HOST, SMTP_USER y SMTP_PASS');
    console.error('Vars:', vars);
    process.exit(1);
  }

  const config = loadConfig();
  const to = resolveRecipient();
  const providerLabel = useBrevo ? 'Brevo API' : `SMTP (${process.env.SMTP_HOST})`;
  const subject = `Reelpath — prueba ${useBrevo ? 'Brevo API' : 'SMTP'}`;
  const html =
    '<p>Este es un correo de prueba de <strong>Reelpath</strong> (Autotube).</p>' +
    `<p>Si lo recibes, ${providerLabel} está configurado correctamente.</p>`;
  const text = `Correo de prueba Reelpath. Si lo recibes, ${providerLabel} está OK.`;

  console.log('Email vars:', vars);
  console.log(`Provider: ${useBrevo ? 'brevo' : 'smtp'}`);
  console.log(`From (EMAIL_FROM): ${config.EMAIL_FROM}`);
  console.log(`To: ${to}`);
  if (!useBrevo) {
    console.log(
      `Host: ${process.env.SMTP_HOST} port=${process.env.SMTP_PORT ?? 587} secure=${process.env.SMTP_SECURE ?? 'false'}`,
    );
  }
  console.log('Enviando...\n');

  const result = await sendEmail({ to, subject, html, text });

  console.log('Resultado:', JSON.stringify(result, null, 2));

  if (!result.sent) {
    console.error('No se envió (modo stub). Revisa BREVO_API_KEY o SMTP_HOST, SMTP_USER y SMTP_PASS.');
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Error al enviar:', message);
  if (err instanceof Error && 'code' in err) {
    console.error('code:', (err as Error & { code?: string }).code);
  }
  if (err instanceof Error && 'response' in err) {
    console.error('response:', (err as Error & { response?: string }).response);
  }
  if (err instanceof Error && 'responseCode' in err) {
    console.error('responseCode:', (err as Error & { responseCode?: number }).responseCode);
  }
  process.exit(1);
});
