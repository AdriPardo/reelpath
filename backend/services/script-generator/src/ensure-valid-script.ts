import { getLlmClient, isLlmMockMode } from '@autotube/llm';
import type { ChannelConfig, ScriptScene, VideoFormat } from '@autotube/shared';
import { getMinScriptWords, LONG_SCENE_WORDS_HARD_MIN, LONG_SCENE_WORDS_MIN } from '@autotube/shared';
import {
  assembleScript,
  detectTransitionGaps,
  expandScene,
  expandScriptToMinDuration,
} from './assemble.js';
import { ensureFinalSceneRetention } from './fix-final-scene.js';
import { expandNarrationProgrammatic } from './programmatic.js';
import type { ScriptOutline } from './types.js';
import {
  findShortScenesForFix,
  isFinalSceneRetentionError,
  validateLongScript,
} from './validate.js';
import { countWords, normalizeScenes, sceneWordSummary, totalSceneWords } from './utils.js';

const MAX_VISUAL_FIXES = 2;
const MAX_SCENE_EXPANSIONS = 4;

const GENERIC_VISUAL_PATTERN = /cinematic,?\s*dramatic lighting,?\s*historical/i;

const TRANSITION_BRIDGES = [
  'Pero la historia no termina ahí.',
  'Sin embargo, lo que ocurrió después cambió todo.',
  'Años después, un nuevo detalle salió a la luz.',
];

function ensureUniqueVisualPrompts(scenes: ScriptScene[], title: string): ScriptScene[] {
  const seen = new Set<string>();
  return scenes.map((scene, i) => {
    let vp = scene.visualPrompt.trim();
    if (!vp || seen.has(vp.toLowerCase()) || isGenericVisual(vp)) {
      vp = diversifyVisualPrompt(scene, i, title);
    }
    let candidate = vp;
    let suffix = 0;
    while (seen.has(candidate.toLowerCase())) {
      candidate = `${vp}, documentary frame ${i + 1} variant ${suffix++}`;
    }
    seen.add(candidate.toLowerCase());
    return { ...scene, visualPrompt: candidate };
  });
}

function expandDurationProgrammatic(scenes: ScriptScene[], minWords: number): ScriptScene[] {
  let updated = [...scenes];
  let guard = 0;
  while (totalSceneWords(updated) < minWords && guard < updated.length * 3) {
    const bodyRanked = updated
      .map((s, idx) => ({ scene: s, index: idx, words: countWords(s.narration) }))
      .filter((d) => d.index > 0)
      .sort((a, b) => a.words - b.words);
    const target = bodyRanked[0];
    if (!target) break;
    const narration = expandNarrationProgrammatic(target.scene.narration, target.words + 12);
    updated[target.index] = {
      ...target.scene,
      narration,
      durationSec: countWords(narration) * 0.45,
    };
    guard++;
  }
  return normalizeScenes(updated);
}

function isGenericVisual(visualPrompt: string): boolean {
  const vp = visualPrompt.trim();
  return vp.length < 35 || GENERIC_VISUAL_PATTERN.test(vp);
}

function fixShortScenesProgrammatic(
  scenes: ScriptScene[],
  targetWords = LONG_SCENE_WORDS_MIN,
): ScriptScene[] {
  return scenes.map((scene, i) => {
    if (i === 0) return scene;
    const words = countWords(scene.narration);
    if (words >= LONG_SCENE_WORDS_HARD_MIN) return scene;
    const narration = expandNarrationProgrammatic(scene.narration, targetWords);
    return {
      ...scene,
      narration,
      durationSec: countWords(narration) * 0.45,
    };
  });
}

function fixTransitionGaps(scenes: ScriptScene[]): ScriptScene[] {
  const gaps = detectTransitionGaps(scenes);
  if (gaps.length === 0) return scenes;

  const updated = [...scenes];
  for (let g = 0; g < gaps.length; g++) {
    const gap = gaps[g]!;
    const idx = gap.to - 1;
    const scene = updated[idx];
    if (!scene) continue;
    const bridge = TRANSITION_BRIDGES[g % TRANSITION_BRIDGES.length]!;
    if (!/^(pero|y|sin embargo|mientras|cuando|años después)/i.test(scene.narration.trim())) {
      const narration = `${bridge} ${scene.narration}`;
      updated[idx] = {
        ...scene,
        narration,
        durationSec: countWords(narration) * 0.45,
      };
    }
  }
  return normalizeScenes(updated);
}

function diversifyVisualPrompt(scene: ScriptScene, index: number, title: string): string {
  const bases = [
    `Aerial documentary shot of historical site related to "${title}", golden hour, scene ${index + 1}`,
    `Close-up of archival documents and maps on wooden desk, warm lamp light, scene ${index + 1}`,
    `Slow tracking shot through ancient stone corridor with torchlight, scene ${index + 1}`,
    `Scholars examining artifacts in museum archive, dramatic side lighting, scene ${index + 1}`,
    `Wide establishing shot of period-accurate landscape with dramatic clouds, scene ${index + 1}`,
  ];
  return bases[index % bases.length]!;
}

async function fixGenericVisualPrompts(
  scenes: ScriptScene[],
  outline: ScriptOutline,
  config: ChannelConfig,
): Promise<ScriptScene[]> {
  let updated = [...scenes];

  if (!isLlmMockMode()) {
    const genericIndices = updated
      .map((s, i) => ({ i, generic: isGenericVisual(s.visualPrompt) }))
      .filter((x) => x.generic)
      .map((x) => x.i)
      .slice(0, MAX_VISUAL_FIXES);

    for (const idx of genericIndices) {
      const scene = updated[idx]!;
      try {
        const llm = getLlmClient();
        const prompt =
          `Genera UN visualPrompt en inglés (15-30 palabras) para esta escena del documental "${outline.title}".\n` +
          `Debe ser concreto, único y cinematográfico — NO genérico.\n` +
          `Narración: "${scene.narration.slice(0, 200)}"\n\n` +
          `JSON: { "visualPrompt": "..." }`;
        const system = config.language.startsWith('es')
          ? 'Director de fotografía documental. visualPrompt único en inglés. JSON válido.'
          : 'Documentary cinematographer. Unique visualPrompt in English. Valid JSON.';
        const raw = await llm.completeJson<{ visualPrompt?: string }>(prompt, system, { maxTokens: 300 });
        const vp = String(raw.visualPrompt ?? '').trim();
        if (vp.length >= 35 && !GENERIC_VISUAL_PATTERN.test(vp)) {
          updated[idx] = { ...scene, visualPrompt: vp };
        }
      } catch {
        // fall through to programmatic uniqueness pass
      }
    }
  }

  return ensureUniqueVisualPrompts(updated, outline.title);
}

/**
 * Auto-corrects script issues locally before returning.
 * One optional LLM polish call for final scene or generic visuals only.
 */
export async function ensureValidScript(params: {
  scenes: ScriptScene[];
  outline: ScriptOutline;
  config: ChannelConfig;
  format: VideoFormat;
}): Promise<ScriptScene[]> {
  const { outline, config, format } = params;
  const minWords = getMinScriptWords(config);
  let scenes = normalizeScenes(params.scenes);

  console.info(`[script] ensureValidScript: entrada ${sceneWordSummary(scenes)}`);

  if (totalSceneWords(scenes) < minWords) {
    console.info(`[script] Expandiendo duración (${totalSceneWords(scenes)}/${minWords} palabras)…`);
    scenes = await expandScriptToMinDuration({ scenes, outline, config, minWords, maxIterations: 6 });
    if (totalSceneWords(scenes) < minWords) {
      scenes = expandDurationProgrammatic(scenes, minWords);
    }
  }

  scenes = fixShortScenesProgrammatic(scenes);

  const shortScenes = findShortScenesForFix(scenes);
  if (shortScenes.length > 0) {
    console.info(`[script] Expandiendo ${Math.min(shortScenes.length, MAX_SCENE_EXPANSIONS)} escena(s) corta(s)…`);
    for (const { index } of shortScenes.slice(0, MAX_SCENE_EXPANSIONS)) {
      const sceneIdx = index - 1;
      scenes[sceneIdx] = await expandScene({
        scene: scenes[sceneIdx]!,
        sceneNumber: index,
        outline,
        config,
      });
    }
    scenes = normalizeScenes(scenes);
  }

  if (config.retentionMode) {
    scenes = await ensureFinalSceneRetention({ scenes, outline, config, format });
  }

  scenes = fixTransitionGaps(scenes);
  scenes = await fixGenericVisualPrompts(scenes, outline, config);

  let validationError = validateLongScript(scenes, format, config);
  if (validationError) {
    console.warn(`[script] Post auto-fix: ${validationError}; último recurso programático…`);

    if (isFinalSceneRetentionError(validationError)) {
      scenes = await ensureFinalSceneRetention({
        scenes,
        outline,
        config,
        format,
        forceProgrammatic: true,
      });
    }

    if (totalSceneWords(scenes) < minWords) {
      scenes = await expandScriptToMinDuration({
        scenes,
        outline,
        config,
        minWords,
        maxIterations: 8,
      });
      scenes = expandDurationProgrammatic(scenes, minWords);
    }

    scenes = fixShortScenesProgrammatic(scenes, LONG_SCENE_WORDS_HARD_MIN);
    scenes = ensureUniqueVisualPrompts(scenes, outline.title);
    validationError = validateLongScript(scenes, format, config);
  }

  if (validationError) {
    console.warn(`[script] ensureValidScript no pudo resolver: ${validationError}`);
  } else {
    console.info(`[script] ensureValidScript OK: ${sceneWordSummary(scenes)}`);
  }

  return scenes;
}

/** Re-export for chunked pipeline assembly helper. */
export { assembleScript };
