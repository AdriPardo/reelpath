#!/usr/bin/env tsx
/**
 * One-time OAuth flow to obtain YOUTUBE_REFRESH_TOKEN.
 *
 * Desktop app (Google Cloud): NO hace falta configurar redirect URI manualmente.
 * Google permite automáticamente http://127.0.0.1:PUERTO para apps de escritorio.
 *
 * Web app: añade en Google Cloud → URIs de redirección:
 *   http://127.0.0.1:3333/oauth2callback
 *
 * Run:
 *   npm run youtube:auth          # automático (recomendado)
 *   npm run youtube:auth -- --paste   # pegar URL/código a mano
 */
import 'dotenv/config';
import http from 'node:http';
import readline from 'node:readline';
import { google } from 'googleapis';

const PORT = 3333;
/** 127.0.0.1 funciona con credenciales "App de escritorio" sin configurar redirect en consola. */
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

async function main() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const manualPaste = process.argv.includes('--paste');

  if (!clientId || !clientSecret) {
    console.error('❌ Falta YOUTUBE_CLIENT_ID o YOUTUBE_CLIENT_SECRET en .env');
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\n🔐 AutoTube — YouTube OAuth\n');

  if (manualPaste) {
    console.log('Modo manual. Abre esta URL, autoriza, y pega la URL final o el código:\n');
    console.log(authUrl);
    console.log('');
    const code = await promptManualCode();
    await finishWithCode(oauth2, code);
    return;
  }

  console.log('Tipo de credencial: App de escritorio ✅');
  console.log('No necesitas añadir redirect URI en Google Cloud (localhost/127.0.0.1 va automático).\n');
  console.log('1. Abre esta URL e inicia sesión con tu canal de YouTube:\n');
  console.log(authUrl);
  console.log('\n2. Tras autorizar, el navegador volverá a 127.0.0.1:3333 automáticamente.');
  console.log('   Si falla la redirección, ejecuta: npm run youtube:auth -- --paste\n');
  console.log('3. Esperando autorización...\n');

  try {
    const code = await waitForAuthCode();
    await finishWithCode(oauth2, code);
  } catch (err) {
    console.error('\n⚠️  Redirección automática falló:', err instanceof Error ? err.message : err);
    console.log('\nPrueba el modo manual:\n  npm run youtube:auth -- --paste\n');
    process.exit(1);
  }
}

async function finishWithCode(
  oauth2: InstanceType<typeof google.auth.OAuth2>,
  code: string,
): Promise<void> {
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      '❌ No se recibió refresh_token. Revoca el acceso en https://myaccount.google.com/permissions',
    );
    console.error('   y vuelve a ejecutar npm run youtube:auth');
    process.exit(1);
  }

  console.log('✅ Autorización correcta. Añade esto a tu .env:\n');
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('YOUTUBE_PRIVACY_STATUS=unlisted');
  console.log('\nReinicia el worker: npm run dev:clean\n');
}

function extractCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('code=')) {
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(`http://x?${trimmed.replace(/^\?/, '')}`);
    const code = url.searchParams.get('code');
    if (code) return code;
  }
  return trimmed;
}

async function promptManualCode(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(
      'Pega la URL completa de redirección (o solo el código):\n> ',
      (line) => {
        rl.close();
        resolve(line);
      },
    );
  });
  return extractCode(answer);
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith('/oauth2callback')) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const url = new URL(req.url, REDIRECT_URI);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Error OAuth</h1><p>${error}</p>`);
          server.close();
          reject(new Error(error));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Falta código de autorización</h1>');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<h1>✅ YouTube conectado</h1><p>Puedes cerrar esta ventana y volver a la terminal.</p>',
        );
        server.close();
        resolve(code);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      // listening
    });

    server.on('error', (err) => reject(err));

    setTimeout(() => {
      server.close();
      reject(new Error('Tiempo de espera agotado (3 min). Usa --paste'));
    }, 180_000);
  });
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
