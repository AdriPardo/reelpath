import { getLlmClient } from '@autotube/llm';
import type { ChannelConfig, ScriptScene, VideoFormat } from '@autotube/shared';
import {
  getLongWordsPerSceneRange,
  getNarrationQualityRules,
  getRetentionClosingPipelineHints,
} from '@autotube/shared';
import type { ScriptOutline } from './types.js';
import { hasRetentionClosing } from './validate.js';
import { countWords } from './utils.js';

const MAX_LLM_FIX_ATTEMPTS = 1;

const LONG_CLOSING_SUFFIXES = [
  ' ¿Y si todo lo que creías saber sobre este episodio fuera solo la mitad de la historia?',
  ' Pero esto no es todo: lo que viene después cambiará por completo cómo entiendes este capítulo.',
  ' La pregunta que queda sin respuesta es: ¿quién tenía realmente la razón?',
];

function pickClosingSuffix(format: VideoFormat): string {
  return LONG_CLOSING_SUFFIXES[Math.floor(Math.random() * LONG_CLOSING_SUFFIXES.length)]!;
}

/** Programmatic fallback when LLM fix is unavailable or fails. */
export function appendCliffhangerFallback(narration: string, format: VideoFormat): string {
  if (hasRetentionClosing(narration, format)) return narration;
  const trimmed = narration.trim().replace(/[.!?…]+$/, '');
  return `${trimmed}.${pickClosingSuffix(format)}`;
}

export function buildFinalSceneRetentionHint(
  lastScene: ScriptScene,
  format: VideoFormat,
): string {
  return (
    `ESCENA FINAL — cierre de retención OBLIGATORIO (modo retención).\n` +
    `Narración actual (NO válida):\n"${lastScene.narration}"\n\n` +
    `Debes reescribir SOLO la última escena para que termine con UNA de estas opciones:\n` +
    `- Pregunta abierta al espectador (ej: "¿Y si todo esto fuera solo el comienzo?")\n` +
    `- Teaser de continuación (ej: "Pero lo que viene después nadie lo esperaba…")\n` +
    `- Cliffhanger reflexivo (ej: "La pregunta que queda es: ¿quién tenía la razón?")\n` +
    (format === 'long'
      ? `- Para documental largo: cierre reflexivo con pregunta retórica también vale.\n`
      : '') +
    `PROHIBIDO: despedidas largas ("gracias por ver", "nos vemos").\n` +
    `${getRetentionClosingPipelineHints(format)}\n`
  );
}

export async function fixFinalSceneRetention(params: {
  scenes: ScriptScene[];
  outline: ScriptOutline;
  config: ChannelConfig;
  format: VideoFormat;
}): Promise<ScriptScene[]> {
  const { scenes, outline, config, format } = params;
  if (scenes.length === 0) return scenes;

  const lastIdx = scenes.length - 1;
  const last = scenes[lastIdx]!;
  if (hasRetentionClosing(last.narration, format)) return scenes;

  const llm = getLlmClient();
  const range = getLongWordsPerSceneRange();
  const prompt =
    `Reescribe SOLO la escena final del guion documental "${outline.title}".\n\n` +
    buildFinalSceneRetentionHint(last, format) +
    `\nLongitud objetivo: ~${range} palabras (actual: ${countWords(last.narration)}).\n` +
    `visualPrompt actual (mantener estilo): "${last.visualPrompt}"\n` +
    `\n${getNarrationQualityRules(config.language, format)}\n\n` +
    `JSON: { "narration": "...", "visualPrompt": "..." }`;

  const system = config.language.startsWith('es')
    ? 'Guionista documental investigativo. Reescribe SOLO la escena final con cierre de retención. JSON válido.'
    : 'Documentary scriptwriter. Rewrite final scene with retention closing. Valid JSON.';

  const raw = await llm.completeJson<{ narration?: string; visualPrompt?: string }>(prompt, system, {
    maxTokens: 800,
  });

  const narration = String(raw.narration ?? last.narration);
  const updated = [...scenes];
  updated[lastIdx] = {
    ...last,
    narration,
    visualPrompt: String(raw.visualPrompt ?? last.visualPrompt),
    durationSec: countWords(narration) * 0.45,
  };
  return updated;
}

/**
 * Ensures the final scene passes retention closing validation.
 * Programmatic fix first (free), then one targeted LLM call if needed.
 */
export async function ensureFinalSceneRetention(params: {
  scenes: ScriptScene[];
  outline: ScriptOutline;
  config: ChannelConfig;
  format: VideoFormat;
  forceProgrammatic?: boolean;
}): Promise<ScriptScene[]> {
  const { outline, config, format, forceProgrammatic } = params;
  let scenes = params.scenes;
  if (scenes.length === 0 || !config.retentionMode) return scenes;

  const last = scenes[scenes.length - 1]!;
  if (hasRetentionClosing(last.narration, format)) return scenes;

  console.info('[script] Escena final sin cierre de retención; aplicando auto-fix…');

  const lastIdx = scenes.length - 1;
  const patched = appendCliffhangerFallback(last.narration, format);
  if (hasRetentionClosing(patched, format)) {
    scenes = [...scenes];
    scenes[lastIdx] = {
      ...last,
      narration: patched,
      durationSec: countWords(patched) * 0.45,
    };
    console.info('[script] Auto-fix escena final: cliffhanger programático aplicado');
    return scenes;
  }

  if (!forceProgrammatic) {
    for (let attempt = 1; attempt <= MAX_LLM_FIX_ATTEMPTS; attempt++) {
      try {
        scenes = await fixFinalSceneRetention({ scenes, outline, config, format });
        const fixedLast = scenes[scenes.length - 1]!;
        if (hasRetentionClosing(fixedLast.narration, format)) {
          console.info(`[script] Auto-fix escena final OK (LLM intento ${attempt})`);
          return scenes;
        }
      } catch (err) {
        console.warn(
          `[script] Auto-fix escena final LLM intento ${attempt} falló: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  scenes = [...scenes];
  scenes[lastIdx] = {
    ...last,
    narration: patched,
    durationSec: countWords(patched) * 0.45,
  };
  console.info('[script] Auto-fix escena final: cliffhanger programático (fallback)');
  return scenes;
}
