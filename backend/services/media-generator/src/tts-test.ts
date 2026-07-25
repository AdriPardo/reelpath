/**
 * Quick TTS smoke test — run: dotenv -e .env -- tsx backend/services/media-generator/src/tts-test.ts
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '@autotube/config';
import { generateSpeech } from './providers/media-providers.js';

const SAMPLE =
  'Atención, esto cambia todo. La inteligencia artificial ya no es ciencia ficción. ' +
  'En segundos, puedes crear vídeos que antes tomaban horas.';

async function main() {
  const config = loadConfig();
  const outPath = path.join(os.tmpdir(), `autotube-tts-test-${Date.now()}.mp3`);

  console.log('TTS smoke test');
  console.log(`  MOCK_EXTERNAL_APIS=${config.MOCK_EXTERNAL_APIS}`);
  console.log(`  ELEVENLABS=${config.ELEVENLABS_API_KEY ? 'set' : 'not set'}`);
  console.log(`  OPENAI=${config.OPENAI_API_KEY ? 'set' : 'not set'}`);
  console.log(`  EDGE enabled=${config.TTS_ENABLE_EDGE}`);
  console.log(`  Sample: ${SAMPLE}\n`);

  const result = await generateSpeech(SAMPLE, outPath, { language: 'es' });
  const stat = await fs.stat(outPath);

  console.log(`\nResult: provider=${result.provider} mock=${result.mock}`);
  console.log(`Output: ${outPath} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error('TTS test failed:', err);
  process.exit(1);
});
