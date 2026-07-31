import { getLlmClient, isLlmMockMode } from '@autotube/llm';
import type { ChannelConfig, ScriptScene } from '@autotube/shared';
import {
  getLongWordsPerSceneRange,
  getMinScriptWords,
  LONG_SCENE_WORDS_MAX,
  LONG_SCENE_WORDS_MIN,
} from '@autotube/shared';
import type { ScriptOutline } from './types.js';
import { countWords, normalizeScenes, totalSceneWords } from './utils.js';
import { expandNarrationProgrammatic } from './programmatic.js';

export function minimalOutline(title: string): ScriptOutline {
  return {
    title,
    description: '',
    tags: [],
    hookA: '',
    hookB: '',
    hookVisualPrompt: '',
    totalScenes: 0,
    sections: [],
  };
}

export function buildHookScene(outline: ScriptOutline, hookText: string): ScriptScene {
  return {
    index: 0,
    narration: hookText,
    visualPrompt: outline.hookVisualPrompt,
    durationSec: countWords(hookText) * 0.45,
  };
}

export function assembleScript(
  outline: ScriptOutline,
  chunkScenes: ScriptScene[][],
  hookText: string,
): ScriptScene[] {
  const hook = buildHookScene(outline, hookText);
  const body = chunkScenes.flat();
  return normalizeScenes([hook, ...body]);
}

export function detectTransitionGaps(scenes: ScriptScene[]): Array<{ from: number; to: number }> {
  const gaps: Array<{ from: number; to: number }> = [];
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1]!.narration.trim();
    const next = scenes[i]!.narration.trim();
    if (!prev || !next) continue;

    const prevLastWord = prev.split(/\s+/).pop()?.toLowerCase().replace(/[.,!?;:]$/, '') ?? '';
    const nextFirstWord = next.split(/\s+/)[0]?.toLowerCase().replace(/[.,!?;:]$/, '') ?? '';

    const abrupt =
      prev.endsWith('.') &&
      !/^(pero|y|sin embargo|mientras|cuando|entonces|así|por eso|de repente|años después|meses después)/i.test(
        next,
      ) &&
      prevLastWord !== nextFirstWord;

    if (abrupt && countWords(prev) > 20 && countWords(next) > 20) {
      gaps.push({ from: i, to: i + 1 });
    }
  }
  return gaps.slice(0, 3);
}

export async function generatePaddingScene(params: {
  outline: ScriptOutline;
  previousScene: ScriptScene;
  sceneNumber: number;
  config: ChannelConfig;
}): Promise<ScriptScene> {
  const { outline, previousScene, sceneNumber, config } = params;
  const range = getLongWordsPerSceneRange();
  const lastSection = outline.sections[outline.sections.length - 1];

  if (isLlmMockMode()) {
    const narration = expandNarrationProgrammatic(
      `El desarrollo continúa desde la escena anterior, profundizando en ${lastSection?.title ?? 'el tema'}.`,
      LONG_SCENE_WORDS_MIN,
    );
    return {
      index: sceneNumber - 1,
      narration,
      visualPrompt: `Documentary closing scene with archival maps and artifacts, frame ${sceneNumber}`,
      durationSec: countWords(narration) * 0.45,
    };
  }

  const llm = getLlmClient();
  const retentionClosing =
    params.config.retentionMode
      ? `\nMODO RETENCIÓN: si es escena de cierre, termina con pregunta abierta, teaser o cliffhanger ` +
        `(ej: "¿Y si todo esto fuera solo el comienzo?").\n`
      : '';

  const prompt =
    `Genera UNA escena adicional de cierre/desarrollo para el guion documental "${outline.title}".\n` +
    `Escena ${sceneNumber} — debe continuar naturalmente desde la escena anterior:\n` +
    `"${previousScene.narration}"\n\n` +
    (lastSection ? `Bloque final "${lastSection.title}": ${lastSection.summary}\n` : '') +
    `Narración: ${range} palabras (mínimo ${LONG_SCENE_WORDS_MIN}).\n` +
    retentionClosing +
    `visualPrompt único en inglés.\n\n` +
    `JSON: { "narration": "...", "visualPrompt": "..." }`;

  const system =
    config.language.startsWith('es')
      ? 'Guionista documental. Una escena adicional en español oral. JSON válido.'
      : 'Documentary scriptwriter. One additional scene. Valid JSON.';

  const raw = await llm.completeJson<{ narration?: string; visualPrompt?: string }>(prompt, system, {
    maxTokens: 800,
  });

  const narration = String(raw.narration ?? '');
  return {
    index: sceneNumber - 1,
    narration,
    visualPrompt: String(raw.visualPrompt ?? previousScene.visualPrompt),
    durationSec: countWords(narration) * 0.45,
  };
}

export async function expandScene(params: {
  scene: ScriptScene;
  sceneNumber: number;
  outline: ScriptOutline;
  config: ChannelConfig;
}): Promise<ScriptScene> {
  const { scene, sceneNumber, outline, config } = params;
  const currentWords = countWords(scene.narration);

  if (isLlmMockMode() || currentWords < LONG_SCENE_WORDS_MIN) {
    const narration = expandNarrationProgrammatic(scene.narration, LONG_SCENE_WORDS_MIN);
    if (countWords(narration) > currentWords) {
      return {
        ...scene,
        narration,
        durationSec: countWords(narration) * 0.45,
      };
    }
  }

  const llm = getLlmClient();
  const range = getLongWordsPerSceneRange();

  const prompt =
    `Expande SOLO esta escena del guion documental "${outline.title}" a ${range} palabras.\n` +
    `Escena ${sceneNumber} actual (${currentWords} palabras):\n"${scene.narration}"\n\n` +
    `Mantén el mismo significado y tono. Añade contexto, detalles y consecuencias sin repetir ideas.\n` +
    `Mínimo ${LONG_SCENE_WORDS_MIN} palabras.\n\n` +
    `JSON: { "narration": "...", "visualPrompt": "${scene.visualPrompt.replace(/"/g, '\\"')}" }`;

  const system =
    config.language.startsWith('es')
      ? 'Expande narración documental en español oral. JSON válido.'
      : 'Expand documentary narration. Valid JSON.';

  const raw = await llm.completeJson<{ narration?: string; visualPrompt?: string }>(prompt, system, {
    maxTokens: 800,
  });

  return {
    ...scene,
    narration: String(raw.narration ?? scene.narration),
    visualPrompt: String(raw.visualPrompt ?? scene.visualPrompt),
    durationSec: countWords(String(raw.narration ?? scene.narration)) * 0.45,
  };
}

/** Expand shortest body scenes or add closing scenes until min word count is met. */
export async function expandScriptToMinDuration(params: {
  scenes: ScriptScene[];
  outline: ScriptOutline;
  config: ChannelConfig;
  minWords?: number;
  maxIterations?: number;
}): Promise<ScriptScene[]> {
  const minWords = params.minWords ?? getMinScriptWords(params.config);
  const maxIterations = params.maxIterations ?? 6;
  let scenes = normalizeScenes(params.scenes);

  for (let i = 0; i < maxIterations; i++) {
    const totalWords = totalSceneWords(scenes);
    if (totalWords >= minWords) {
      if (i > 0) {
        console.info(`[script] Expansión automática OK: ${scenes.length} escenas, ${totalWords} palabras`);
      }
      return scenes;
    }

    const deficit = minWords - totalWords;
    console.info(
      `[script] Expansión automática (${i + 1}/${maxIterations}): faltan ${deficit} palabras ` +
        `(${totalWords}/${minWords})`,
    );

    const bodyRanked = scenes
      .map((s, idx) => ({ scene: s, index: idx + 1, words: countWords(s.narration) }))
      .filter((d) => d.index > 1)
      .sort((a, b) => a.words - b.words);

    const expandTarget = bodyRanked.find((d) => d.words < LONG_SCENE_WORDS_MAX + 25);
    if (expandTarget) {
      const sceneIdx = expandTarget.index - 1;
      const scene = scenes[sceneIdx]!;
      const programmatic = expandNarrationProgrammatic(scene.narration, LONG_SCENE_WORDS_MIN);
      if (countWords(programmatic) > countWords(scene.narration)) {
        scenes[sceneIdx] = {
          ...scene,
          narration: programmatic,
          durationSec: countWords(programmatic) * 0.45,
        };
        scenes = normalizeScenes(scenes);
        continue;
      }
      scenes[sceneIdx] = await expandScene({
        scene: scenes[sceneIdx]!,
        sceneNumber: expandTarget.index,
        outline: params.outline,
        config: params.config,
      });
      scenes = normalizeScenes(scenes);
      continue;
    }

    const previous = scenes[scenes.length - 1]!;
    const padding = await generatePaddingScene({
      outline: params.outline,
      previousScene: previous,
      sceneNumber: scenes.length + 1,
      config: params.config,
    });
    scenes = normalizeScenes([...scenes, padding]);
  }

  return scenes;
}
