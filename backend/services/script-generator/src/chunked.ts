import { getMinScenes } from '@autotube/config';
import type { ChannelConfig, ScriptScene } from '@autotube/shared';
import { applyVisualSourceToScenes, getMinScriptWords, getTargetScriptWords } from '@autotube/shared';
import { isLlmMockMode } from '@autotube/llm';
import { assembleScript, buildHookScene, expandScriptToMinDuration, generatePaddingScene } from './assemble.js';
import { generateChunk } from './chunk.js';
import { ensureValidScript } from './ensure-valid-script.js';
import { ScriptValidationError } from './errors.js';
import { generateOutline } from './outline.js';
import { validateLongScript } from './validate.js';
import { normalizeScenes, sceneOptions, sceneWordSummary, totalSceneWords, countWords } from './utils.js';

export async function generateChunkedScript(params: {
  idea: { title: string; hook: string; angle: string };
  config: ChannelConfig;
  channelContext: string;
}): Promise<{
  title: string;
  description: string;
  tags: string[];
  hookA: string;
  hookB: string;
  hookVisualPrompt: string;
  scenes: ScriptScene[];
}> {
  const { idea, config, channelContext } = params;
  if (isLlmMockMode()) {
    console.info('[script] MOCK — sin coste API');
  }

  console.info('[script] Modo chunked: generando outline…');
  const outline = await generateOutline({ idea, config, channelContext });
  const targetTotalWords = getTargetScriptWords(config);

  const chunkResults: ScriptScene[][] = [];
  let previousScenes: ScriptScene[] = [];
  let transitionFromPrevious: string | undefined;
  let cumulativeWords = countWords(outline.hookA);

  for (let i = 0; i < outline.sections.length; i++) {
    const section = outline.sections[i]!;
    if (i > 0) {
      transitionFromPrevious = outline.sections[i - 1]!.transitionToNext;
    }

    const chunkScenes = await generateChunk({
      outline,
      section,
      sectionIndex: i,
      previousScenes,
      transitionFromPrevious,
      config,
      channelContext,
      cumulativeWords,
      targetTotalWords,
    });

    chunkResults.push(chunkScenes);
    previousScenes = [...previousScenes, ...chunkScenes];
    cumulativeWords = totalSceneWords([buildHookScene(outline, outline.hookA), ...previousScenes]);
  }

  let scenes = assembleScript(outline, chunkResults, outline.hookA);
  console.info(`[script] Ensamblado: ${sceneWordSummary(scenes)}`);

  const minScenes = getMinScenes('long', sceneOptions(config));
  if (scenes.length < minScenes || scenes.length < outline.totalScenes) {
    const target = Math.max(minScenes, outline.totalScenes);
    const deficit = target - scenes.length;
    console.warn(
      `[script] Ensamblado con ${scenes.length} escenas (objetivo ${target}); generando ${deficit} escena(s) de compensación…`,
    );
    for (let i = 0; i < deficit; i++) {
      const previous = scenes[scenes.length - 1]!;
      const padding = await generatePaddingScene({
        outline,
        previousScene: previous,
        sceneNumber: scenes.length + 1,
        config,
      });
      scenes = normalizeScenes([...scenes, padding]);
    }
    console.info(`[script] Tras compensación: ${sceneWordSummary(scenes)}`);
  }

  const minWords = getMinScriptWords(config);
  if (totalSceneWords(scenes) < minWords) {
    console.info(`[script] Guion ensamblado bajo mínimo (${totalSceneWords(scenes)}/${minWords}); expandiendo…`);
    scenes = await expandScriptToMinDuration({ scenes, outline, config, minWords });
    console.info(`[script] Tras expansión inicial: ${sceneWordSummary(scenes)}`);
  }

  scenes = await ensureValidScript({ scenes, outline, config, format: 'long' });

  const finalError = validateLongScript(scenes, 'long', config);
  if (finalError) {
    throw new ScriptValidationError(`Guion chunked inválido tras auto-fix: ${finalError}`);
  }

  scenes = applyVisualSourceToScenes(scenes, config);

  return {
    title: outline.title,
    description: outline.description,
    tags: outline.tags,
    hookA: outline.hookA,
    hookB: outline.hookB,
    hookVisualPrompt: outline.hookVisualPrompt,
    scenes,
  };
}
