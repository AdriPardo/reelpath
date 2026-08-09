/**
 * Ops: upsert platform AI keys into PlatformSecret (overwrite on rotate).
 * Prefer Atlas seed + envFrom long-term (ADR-0017). This script is the
 * Reelpath-side bridge until runtime always prefers process.env.
 *
 * Usage (from Reelpath repo root / inside API container):
 *   OPENAI_API_KEY=... ELEVENLABS_API_KEY=... npm run secrets:seed-from-env
 *
 * Never commit real keys. Does not wipe unrelated PlatformSecret rows.
 */
import 'dotenv/config';
import {
  getPlatformSecretsStatus,
  loadPlatformSecretsOverrides,
  prisma,
  upsertPlatformApiKey,
  upsertPlatformYouTubeOAuthApp,
  type PlatformSecretKey,
} from '@autotube/database';

async function main() {
  const upserted: PlatformSecretKey[] = [];

  const openai = process.env.OPENAI_API_KEY?.trim();
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim();
  const eleven = process.env.ELEVENLABS_API_KEY?.trim();
  const fal = process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim();
  const pexels = process.env.PEXELS_API_KEY?.trim();
  const ytId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const ytSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();

  if (openai) {
    await upsertPlatformApiKey('openai', openai);
    upserted.push('openai');
  }
  if (deepseek) {
    await upsertPlatformApiKey('deepseek', deepseek);
    upserted.push('deepseek');
  }
  if (eleven) {
    await upsertPlatformApiKey('elevenlabs', eleven);
    upserted.push('elevenlabs');
  }
  if (fal) {
    await upsertPlatformApiKey('fal', fal);
    upserted.push('fal');
  }
  if (pexels) {
    await upsertPlatformApiKey('pexels', pexels);
    upserted.push('pexels');
  }
  if (ytId && ytSecret) {
    await upsertPlatformYouTubeOAuthApp({ clientId: ytId, clientSecret: ytSecret });
    upserted.push('youtube_oauth_app');
  }

  await loadPlatformSecretsOverrides();
  const status = await getPlatformSecretsStatus();

  if (upserted.length === 0) {
    console.log(
      'Nada que upsert (faltan OPENAI_API_KEY / DEEPSEEK_API_KEY / ELEVENLABS_API_KEY / … en env).',
    );
  } else {
    console.log(`Upserted PlatformSecret keys: ${upserted.join(', ')}`);
  }
  console.log(
    JSON.stringify({
      status: {
        hasOpenaiKey: status.hasOpenaiKey,
        hasDeepseekKey: status.hasDeepseekKey,
        hasElevenLabsKey: status.hasElevenLabsKey,
        hasPexelsKey: status.hasPexelsKey,
        hasYoutubeOAuthApp: status.hasYoutubeOAuthApp,
      },
    }),
  );
  console.log(
    'Ops note: prefer Atlas scripts/seed-project-secrets.sh + atlas.yml envFrom; end-users never paste keys in UI.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
