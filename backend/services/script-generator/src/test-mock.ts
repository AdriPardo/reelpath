/**
 * Verifica generateChunkedScript con mocks (sin coste API).
 * Uso: MOCK_EXTERNAL_APIS=true npx tsx backend/services/script-generator/src/test-mock.ts
 */
import 'dotenv/config';
import { parseChannelConfig } from '@autotube/config';
import { generateChunkedScript } from './chunked.js';
import { validateLongScript } from './validate.js';
import { sceneWordSummary } from './utils.js';

async function main() {
  process.env.MOCK_EXTERNAL_APIS = 'true';

  const config = parseChannelConfig({
    niche: 'historia y curiosidades del mundo',
    videoFormat: 'long',
    aspectRatio: '16:9',
    templateId: 'long-default',
    language: 'es',
    retentionMode: true,
    targetDurationMinSec: 480,
    targetDurationMaxSec: 900,
    scriptGenerationMode: 'chunked',
    tone: 'documental apasionado',
    customPromptHints: 'Documental investigativo con datos concretos.',
  });

  const idea = {
    title: 'El médico que inventó la anestesia y murió en la pobreza',
    hook: '¿Sabías que el hombre que te quitó el dolor murió sin reconocimiento?',
    angle: 'La paradoja de un descubrimiento que salvó millones de vidas pero arruinó a su creador',
  };

  const channelContext =
    '\n\nCONTEXTO DEL CANAL:\nTono narrativo: documental apasionado.\n';

  console.info('[test] Generando guion chunked con MOCK…');
  const result = await generateChunkedScript({ idea, config, channelContext });

  const validationError = validateLongScript(result.scenes, 'long', config);
  if (validationError) {
    console.error(`[test] FALLO validación: ${validationError}`);
    process.exit(1);
  }

  console.info(`[test] OK — ${sceneWordSummary(result.scenes)}`);
  console.info(`[test] Título: ${result.title}`);
  console.info(`[test] Escena 1: "${result.scenes[0]?.narration}"`);
  const last = result.scenes[result.scenes.length - 1];
  console.info(`[test] Escena final: "${last?.narration.slice(0, 120)}…"`);
}

main().catch((err) => {
  console.error('[test] Error:', err);
  process.exit(1);
});
