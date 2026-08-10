import { getLlmClient } from '@autotube/llm';
import type { ChannelConfig, ScriptScene } from '@autotube/shared';
import { countWords } from './utils.js';

const MAX_LLM_FIX_ATTEMPTS = 1;

const TEASER_HOOK_PREFIXES = [
  '¿Sabías que ',
  'Nadie te contó que ',
  '¿Y si ',
];

const TEASER_HOOK_SUFFIXES = [
  ' cambia todo lo que creías?',
  ' es imposible de creer?',
  ' ocultó este detalle durante décadas?',
];

/** Detecta si la narración abre con gancho válido para teaser/Short. */
export function hasTeaserHook(narration: string): boolean {
  const text = narration.trim();
  if (!text) return false;
  if (/[?!¿]/.test(text)) return true;
  if (/\d[\d.,]*\s*(%|millones|billones|años|personas|dólares|euros)?/i.test(text)) return true;
  if (
    /\b(nunca|imposible|secreto|nadie|olvidad|mentira|falso|ocult|paradoja|extraño|sorprend|fraude|escándalo|increíble|chocante|sabías|imagina)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/^(¿|nadie|nunca|sabías|imagina|este|esta)\b/i.test(text)) return true;
  return false;
}

export function hasTeaserCta(narration: string): boolean {
  return /\b(vídeo completo|video completo|canal|mira|ver más|historia entera|descubre|suscríb|link)\b/i.test(
    narration,
  );
}

/** Fallback programático cuando el LLM no genera gancho válido. */
export function appendTeaserHookFallback(narration: string): string {
  if (hasTeaserHook(narration)) return narration;
  const trimmed = narration.trim().replace(/[.!?…]+$/, '');
  if (countWords(trimmed) > 10) {
    const prefix = TEASER_HOOK_PREFIXES[Math.floor(Math.random() * TEASER_HOOK_PREFIXES.length)]!;
    const suffix = TEASER_HOOK_SUFFIXES[Math.floor(Math.random() * TEASER_HOOK_SUFFIXES.length)]!;
    return `${prefix}este caso${suffix}`;
  }
  const suffix = TEASER_HOOK_SUFFIXES[Math.floor(Math.random() * TEASER_HOOK_SUFFIXES.length)]!;
  return `${trimmed}${suffix}`;
}

export function appendTeaserCtaFallback(narration: string): string {
  if (hasTeaserCta(narration)) return narration;
  const trimmed = narration.trim().replace(/[.!?…]+$/, '');
  return `${trimmed}. Mira el vídeo completo en el canal.`;
}

export function buildTeaserHookHint(scene: ScriptScene): string {
  return (
    `ESCENA 1 — GANCHO OBLIGATORIO (<3s, máx 12 palabras):\n` +
    `Narración actual (NO válida):\n"${scene.narration}"\n\n` +
    `Debe abrir con UNA de estas opciones:\n` +
    `- Pregunta provocadora (ej: "¿Y si todo esto fuera mentira?")\n` +
    `- Dato imposible con cifra (ej: "2.400 millones desaparecieron en 48 horas")\n` +
    `- Pattern-interrupt (ej: "Nadie sabe que…", "Este secreto oculto…")\n` +
    `PROHIBIDO: intros lentas ("Hoy vamos a", "En este vídeo", "Bienvenidos").\n`
  );
}

export function buildTeaserCtaHint(scene: ScriptScene): string {
  return (
    `ESCENA FINAL — CTA OBLIGATORIO al vídeo largo:\n` +
    `Narración actual (NO válida):\n"${scene.narration}"\n\n` +
    `Debe invitar a ver el vídeo completo en el canal. Ejemplos:\n` +
    `- "Mira el vídeo completo en el canal para la historia entera."\n` +
    `- "La historia entera te espera en el canal."\n`
  );
}

export async function fixTeaserHookWithLlm(params: {
  scenes: ScriptScene[];
  config: ChannelConfig;
  longVideoTitle: string;
}): Promise<ScriptScene[]> {
  const { scenes, config, longVideoTitle } = params;
  if (scenes.length === 0) return scenes;

  const first = scenes[0]!;
  if (hasTeaserHook(first.narration)) return scenes;

  const llm = getLlmClient();
  const prompt =
    `Reescribe SOLO la escena 1 (gancho) del teaser Short para "${longVideoTitle}".\n\n` +
    buildTeaserHookHint(first) +
    `\nLongitud máxima: 12 palabras (actual: ${countWords(first.narration)}).\n` +
    `visualPrompt actual (mantener estilo): "${first.visualPrompt}"\n` +
    `Español oral, pattern-interrupt, sin intros lentas.\n\n` +
    `JSON: { "narration": "...", "visualPrompt": "..." }`;

  const system = config.language.startsWith('es')
    ? 'Guionista de Shorts verticales. Reescribe SOLO el gancho de escena 1. JSON válido.'
    : 'Short-form scriptwriter. Rewrite scene 1 hook only. Valid JSON.';

  const raw = await llm.completeJson<{ narration?: string; visualPrompt?: string }>(prompt, system, {
    maxTokens: 500,
  });

  const narration = String(raw.narration ?? first.narration);
  const updated = [...scenes];
  updated[0] = {
    ...first,
    narration,
    visualPrompt: String(raw.visualPrompt ?? first.visualPrompt),
    durationSec: countWords(narration) * 0.45,
  };
  return updated;
}

/**
 * Asegura que escena 1 y escena final cumplan gancho + CTA de teaser.
 * Primero fix programático (gratis), luego una llamada LLM si hace falta.
 */
export async function ensureTeaserScriptShape(params: {
  scenes: ScriptScene[];
  config: ChannelConfig;
  longVideoTitle?: string;
  forceProgrammatic?: boolean;
}): Promise<ScriptScene[]> {
  const { config, forceProgrammatic, longVideoTitle = 'el vídeo largo' } = params;
  let scenes = params.scenes;
  if (scenes.length === 0) return scenes;

  let changed = false;

  const first = scenes[0]!;
  if (!hasTeaserHook(first.narration)) {
    console.info('[teaser-script] Escena 1 sin gancho válido; aplicando auto-fix…');
    const patchedHook = appendTeaserHookFallback(first.narration);
    if (hasTeaserHook(patchedHook)) {
      scenes = [...scenes];
      scenes[0] = {
        ...first,
        narration: patchedHook,
        durationSec: countWords(patchedHook) * 0.45,
      };
      changed = true;
      console.info('[teaser-script] Auto-fix escena 1: gancho programático aplicado');
    }
  }

  const lastIdx = scenes.length - 1;
  const last = scenes[lastIdx]!;
  if (!hasTeaserCta(last.narration)) {
    const patchedCta = appendTeaserCtaFallback(last.narration);
    scenes = [...scenes];
    scenes[lastIdx] = {
      ...last,
      narration: patchedCta,
      durationSec: countWords(patchedCta) * 0.45,
    };
    changed = true;
    console.info('[teaser-script] Auto-fix escena final: CTA programático aplicado');
  }

  if (!changed) return scenes;

  const firstAfter = scenes[0]!;
  if (!forceProgrammatic && !hasTeaserHook(firstAfter.narration)) {
    for (let attempt = 1; attempt <= MAX_LLM_FIX_ATTEMPTS; attempt++) {
      try {
        scenes = await fixTeaserHookWithLlm({ scenes, config, longVideoTitle });
        if (hasTeaserHook(scenes[0]!.narration)) {
          console.info(`[teaser-script] Auto-fix escena 1 OK (LLM intento ${attempt})`);
          break;
        }
      } catch (err) {
        console.warn(
          `[teaser-script] Auto-fix escena 1 LLM intento ${attempt} falló: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  const hookStillBad = !hasTeaserHook(scenes[0]!.narration);
  if (hookStillBad) {
    const firstScene = scenes[0]!;
    const forced = appendTeaserHookFallback(firstScene.narration);
    scenes = [...scenes];
    scenes[0] = {
      ...firstScene,
      narration: forced,
      durationSec: countWords(forced) * 0.45,
    };
    console.info('[teaser-script] Auto-fix escena 1: gancho programático (fallback final)');
  }

  const lastScene = scenes[scenes.length - 1]!;
  if (!hasTeaserCta(lastScene.narration)) {
    const forcedCta = appendTeaserCtaFallback(lastScene.narration);
    scenes = [...scenes];
    scenes[scenes.length - 1] = {
      ...lastScene,
      narration: forcedCta,
      durationSec: countWords(forcedCta) * 0.45,
    };
    console.info('[teaser-script] Auto-fix escena final: CTA programático (fallback final)');
  }

  return scenes;
}
