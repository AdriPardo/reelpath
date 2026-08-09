/**
 * One-shot: importa API keys / YouTube OAuth app desde .env legacy → PlatformSecret.
 * Uso: npm run secrets:import-from-env
 *
 * No sobrescribe secretos ya presentes en BD. Tras importar, quita las vars del .env.
 */
import 'dotenv/config';
import {
  importPlatformSecretsFromEnvIfEmpty,
  loadPlatformSecretsOverrides,
  prisma,
} from '@autotube/database';

async function main() {
  const { imported } = await importPlatformSecretsFromEnvIfEmpty({
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    FAL_KEY: process.env.FAL_KEY,
    FAL_API_KEY: process.env.FAL_API_KEY,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY,
  });

  await loadPlatformSecretsOverrides();

  if (imported.length === 0) {
    console.log(
      'Nada que importar (ya hay secretos en BD o el .env no tiene keys legacy).',
    );
  } else {
    console.log(`Importados: ${imported.join(', ')}`);
    console.log(
      'Puedes eliminar del .env: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, OPENAI_API_KEY, DEEPSEEK_API_KEY, ELEVENLABS_API_KEY, FAL_KEY, FAL_API_KEY, PEXELS_API_KEY',
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
