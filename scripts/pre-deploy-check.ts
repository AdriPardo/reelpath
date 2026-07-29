/**
 * Checklist go/no-go antes de desplegar Reelpath en producción.
 *
 * Uso:
 *   npm run pre-deploy:check
 *   NODE_ENV=production npm run pre-deploy:check
 *   HEALTHCHECK_URL=https://app.tudominio.com npm run pre-deploy:check
 *
 * No imprime valores de secretos — solo SET/MISSING/placeholder.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Status = 'ok' | 'warn' | 'fail';

interface Check {
  name: string;
  status: Status;
  detail: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const args = new Set(process.argv.slice(2));
const strictProd = args.has('--strict-prod') || process.env.NODE_ENV === 'production';
const skipHealth = args.has('--skip-health');
const skipDb = args.has('--skip-db');

function env(key: string): string | undefined {
  const v = process.env[key];
  return v?.trim() || undefined;
}

function isPlaceholder(value: string): boolean {
  return /cambia|genera|tudominio|changeme|example|xxx|tu@email|placeholder|your-/i.test(value);
}

function isLocalhostUrl(value: string): boolean {
  return /localhost|127\.0\.0\.1/.test(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function varStatus(key: string, opts?: { required?: boolean; prodOnly?: boolean }): Check {
  const value = env(key);
  if (!value) {
    const status: Status = opts?.required || (opts?.prodOnly && strictProd) ? 'fail' : 'warn';
    return { name: key, status, detail: 'MISSING' };
  }
  if (isPlaceholder(value)) {
    return { name: key, status: 'fail', detail: 'SET (placeholder — cámbialo)' };
  }
  if ((key === 'FRONTEND_URL' || key === 'NEXT_PUBLIC_API_URL') && strictProd && isLocalhostUrl(value)) {
    return { name: key, status: 'fail', detail: 'SET (localhost — usa dominio HTTPS real)' };
  }
  if ((key === 'FRONTEND_URL' || key === 'NEXT_PUBLIC_API_URL') && strictProd && !isHttpsUrl(value)) {
    return { name: key, status: 'fail', detail: 'SET (debe ser https:// en producción)' };
  }
  return { name: key, status: 'ok', detail: 'SET' };
}

function boolCheck(key: string, expected: boolean, required = true): Check {
  const raw = env(key);
  const actual = raw === 'true';
  if (raw === undefined) {
    return { name: key, status: required ? 'fail' : 'warn', detail: 'MISSING' };
  }
  if (actual !== expected) {
    return {
      name: key,
      status: 'fail',
      detail: `=${raw} (se esperaba ${expected ? 'true' : 'false'})`,
    };
  }
  return { name: key, status: 'ok', detail: `=${raw}` };
}

function checkStripe(): Check[] {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) {
    return [{ name: 'Stripe', status: 'warn', detail: 'STRIPE_SECRET_KEY no definido (billing desactivado)' }];
  }

  const isLive = key.startsWith('sk_live_');
  const isTest = key.startsWith('sk_test_');
  const results: Check[] = [
    {
      name: 'STRIPE_SECRET_KEY',
      status: 'ok',
      detail: isLive ? 'SET (live)' : isTest ? 'SET (test — usa sk_live_ en prod)' : 'SET (formato desconocido)',
    },
  ];

  if (isLive || strictProd) {
    for (const k of [
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_STARTER',
      'STRIPE_PRICE_PRO',
      'STRIPE_PRICE_UNLIMITED',
    ]) {
      results.push(varStatus(k, { required: isLive }));
    }
    if (isLive) {
      results.push({
        name: 'Stripe webhook URL',
        status: env('DOMAIN') ? 'ok' : 'warn',
        detail: env('DOMAIN')
          ? `https://${env('DOMAIN')}/api/billing/webhook`
          : 'Define DOMAIN para verificar URL del webhook',
      });
    }
  }

  return results;
}

function checkSmtp(): Check[] {
  const brevoKey = env('BREVO_API_KEY');
  const host = env('SMTP_HOST');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  const from = env('EMAIL_FROM');

  if (brevoKey) {
    return [
      { name: 'BREVO_API_KEY', status: 'ok', detail: 'SET' },
      {
        name: 'EMAIL_FROM',
        status: from ? 'ok' : 'warn',
        detail: from ? 'SET' : 'MISSING (default en código)',
      },
    ];
  }

  if (!host && !user && !pass) {
    return [
      {
        name: 'Email',
        status: strictProd ? 'fail' : 'warn',
        detail: 'No configurado (BREVO_API_KEY o SMTP — emails en modo stub)',
      },
    ];
  }

  const results: Check[] = [];
  for (const [key, val] of [
    ['SMTP_HOST', host],
    ['SMTP_USER', user],
    ['SMTP_PASS', pass],
  ] as const) {
    results.push({
      name: key,
      status: val ? 'ok' : 'fail',
      detail: val ? 'SET' : 'MISSING',
    });
  }
  results.push({
    name: 'EMAIL_FROM',
    status: from ? 'ok' : 'warn',
    detail: from ? 'SET' : 'MISSING (default en código)',
  });
  return results;
}

function checkYouTube(): Check[] {
  const id = env('YOUTUBE_CLIENT_ID');
  const secret = env('YOUTUBE_CLIENT_SECRET');
  const redirect = env('YOUTUBE_OAUTH_REDIRECT_URI');
  const domain = env('DOMAIN');

  const results: Check[] = [
    {
      name: 'YOUTUBE_CLIENT_ID/SECRET',
      status: id || secret ? 'warn' : 'ok',
      detail:
        id || secret
          ? 'Legacy .env — migra a Ajustes → Secretos de plataforma (npm run secrets:import-from-env)'
          : 'OK (configurar en UI Secretos de plataforma)',
    },
  ];

  const expectedRedirect = domain
    ? `https://${domain}/api/integrations/youtube/callback`
    : undefined;

  if (!redirect) {
    results.push({
      name: 'YOUTUBE_OAUTH_REDIRECT_URI',
      status: strictProd ? (domain ? 'warn' : 'fail') : 'warn',
      detail: domain
        ? `MISSING (docker-compose.prod.yml usará ${expectedRedirect})`
        : strictProd
          ? 'MISSING — define DOMAIN o YOUTUBE_OAUTH_REDIRECT_URI'
          : 'MISSING (OK en local — default localhost:4000)',
    });
  } else if (strictProd && isLocalhostUrl(redirect)) {
    results.push({
      name: 'YOUTUBE_OAUTH_REDIRECT_URI',
      status: 'fail',
      detail: 'SET (localhost — registra URI HTTPS en Google Cloud)',
    });
  } else if (expectedRedirect && redirect !== expectedRedirect) {
    results.push({
      name: 'YOUTUBE_OAUTH_REDIRECT_URI',
      status: 'warn',
      detail: `SET (esperado: ${expectedRedirect})`,
    });
  } else {
    results.push({ name: 'YOUTUBE_OAUTH_REDIRECT_URI', status: 'ok', detail: 'SET' });
  }

  return results;
}

function checkDbMigrations(): Check {
  if (skipDb) {
    return { name: 'DB migraciones', status: 'warn', detail: 'Omitido (--skip-db)' };
  }
  if (!env('DATABASE_URL')) {
    return { name: 'DB migraciones', status: 'warn', detail: 'DATABASE_URL no definido — omitido' };
  }

  try {
    execSync('npm run migrate:deploy -w @autotube/database -- --help', {
      cwd: ROOT,
      stdio: 'pipe',
    });
  } catch {
    // ignore — solo comprobamos que npm workspace existe
  }

  try {
    const out = execSync(
      'dotenv -e .env -- npx prisma migrate status --schema backend/core/database/prisma/schema.prisma',
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (/following migration have not yet been applied/i.test(out) || /Database schema is not up to date/i.test(out)) {
      return {
        name: 'DB migraciones',
        status: 'fail',
        detail: 'Hay migraciones pendientes — ejecuta npm run db:migrate:deploy',
      };
    }
    return { name: 'DB migraciones', status: 'ok', detail: 'Al día' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/P1001|ECONNREFUSED|Can't reach database/i.test(msg)) {
      return {
        name: 'DB migraciones',
        status: 'warn',
        detail: 'Postgres no accesible — arranca docker compose o verifica DATABASE_URL',
      };
    }
    return { name: 'DB migraciones', status: 'warn', detail: 'No se pudo verificar (¿Postgres caído?)' };
  }
}

async function checkConfigSystem(): Promise<Check> {
  try {
    process.env.NODE_ENV = strictProd ? 'production' : process.env.NODE_ENV ?? 'development';
    const { loadConfig } = await import('../backend/core/config-system/src/index.ts');
    loadConfig();
    return { name: 'config-system (prod validation)', status: 'ok', detail: 'Pasa validación' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: 'config-system (prod validation)', status: 'fail', detail: msg };
  }
}

async function checkHealthEndpoints(): Promise<Check[]> {
  if (skipHealth) {
    return [{ name: 'Health endpoints', status: 'warn', detail: 'Omitido (--skip-health)' }];
  }

  const baseUrl = env('HEALTHCHECK_URL') ?? (strictProd ? undefined : 'http://localhost:4000');
  if (!baseUrl) {
    return [
      {
        name: 'Health endpoints',
        status: 'warn',
        detail: 'Define HEALTHCHECK_URL=https://tu-dominio o arranca API local',
      },
    ];
  }

  const endpoints = ['/health', '/ready', '/health/extended', '/metrics'];
  const results: Check[] = [];

  for (const endpoint of endpoints) {
    const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'reelpath-pre-deploy-check' } });
      if (!res.ok) {
        results.push({
          name: `GET ${endpoint}`,
          status: 'fail',
          detail: `HTTP ${res.status}`,
        });
        continue;
      }
      if (endpoint === '/health') {
        const body = (await res.json()) as { service?: string };
        const svc = body.service ?? 'unknown';
        results.push({
          name: `GET ${endpoint}`,
          status: svc === 'reelpath-api' ? 'ok' : 'warn',
          detail: svc === 'reelpath-api' ? '200 reelpath-api' : `200 service=${svc} (esperado reelpath-api)`,
        });
      } else if (endpoint === '/health/extended') {
        const body = (await res.json()) as { status?: string };
        results.push({
          name: `GET ${endpoint}`,
          status: body.status === 'ok' ? 'ok' : 'fail',
          detail: body.status === 'ok' ? '200 ok' : `degraded (${body.status})`,
        });
      } else {
        results.push({ name: `GET ${endpoint}`, status: 'ok', detail: `HTTP ${res.status}` });
      }
    } catch {
      results.push({
        name: `GET ${endpoint}`,
        status: 'fail',
        detail: `No accesible en ${baseUrl}`,
      });
    }
  }

  return results;
}

function printChecks(title: string, checks: Check[]) {
  console.log(`\n── ${title} ──`);
  for (const c of checks) {
    const icon = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️ ' : '❌';
    console.log(`${icon} ${c.name}: ${c.detail}`);
  }
}

async function main() {
  console.log('Reelpath — pre-deploy check (go/no-go)\n');
  console.log(`Modo: ${strictProd ? 'producción estricta' : 'local/desarrollo'}`);
  if (!existsSync(path.join(ROOT, '.env'))) {
    console.log('\n❌ No existe .env — copia .env.production.example → .env en el servidor');
    process.exit(1);
  }

  const envChecks: Check[] = [
    varStatus('DOMAIN', { required: strictProd }),
    varStatus('ACME_EMAIL', { prodOnly: true }),
    varStatus('POSTGRES_PASSWORD', { prodOnly: true }),
    varStatus('AUTH_SECRET', { required: strictProd }),
    boolCheck('AUTH_REQUIRED', true),
    boolCheck('NEXT_PUBLIC_AUTH_REQUIRED', true, strictProd),
    boolCheck('MOCK_EXTERNAL_APIS', false),
    varStatus('CREDENTIALS_ENCRYPTION_KEY', { required: strictProd }),
    varStatus('FRONTEND_URL', { required: strictProd }),
    varStatus('NEXT_PUBLIC_API_URL', { required: strictProd }),
    {
      name: 'OPENAI_API_KEY (legacy env)',
      status: env('OPENAI_API_KEY') ? 'warn' : 'ok',
      detail: env('OPENAI_API_KEY')
        ? 'Legacy .env — preferir Ajustes → Secretos de plataforma'
        : 'OK (UI Secretos de plataforma)',
    },
    varStatus('DATABASE_URL'),
    varStatus('REDIS_URL'),
    {
      name: 'SEED_DEMO',
      status: env('SEED_DEMO') === 'false' ? 'ok' : strictProd ? 'fail' : 'warn',
      detail:
        env('SEED_DEMO') === 'false'
          ? '=false (sin canales demo)'
          : `=${env('SEED_DEMO') ?? 'no definido'} — en prod usa SEED_DEMO=false`,
    },
  ];

  printChecks('Variables de entorno', envChecks);
  printChecks('YouTube OAuth', checkYouTube());
  printChecks('Stripe', checkStripe());
  printChecks('Email', checkSmtp());

  const dbCheck = checkDbMigrations();
  printChecks('Base de datos', [dbCheck]);

  const healthChecks = await checkHealthEndpoints();
  printChecks('Health endpoints', healthChecks);

  const cfgCheck = strictProd ? await checkConfigSystem() : null;
  if (cfgCheck) {
    printChecks('Validación config-system', [cfgCheck]);
  }

  const all: Check[] = [
    ...envChecks,
    ...checkYouTube(),
    ...checkStripe(),
    ...checkSmtp(),
    dbCheck,
    ...healthChecks,
    ...(cfgCheck ? [cfgCheck] : []),
  ];

  const fails = all.filter((c) => c.status === 'fail').length;
  const warns = all.filter((c) => c.status === 'warn').length;

  console.log('\n── Resumen ──');
  console.log(`Fallos: ${fails} · Avisos: ${warns}`);

  if (fails > 0) {
    console.log('\n❌ NO-GO — corrige los fallos antes de desplegar.');
    process.exit(1);
  }

  if (warns > 0) {
    console.log('\n⚠️  GO con reservas — revisa los avisos.');
    process.exit(0);
  }

  console.log('\n✅ GO — listo para desplegar.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
