import { prisma } from '@autotube/database';
import { getMaxScenes, getMinScenes, isScriptDevMode, loadConfig } from '@autotube/config';
import { extractScenes, extractScriptResponse, getActiveLlmLabel, getLlmClient, isLlmMockMode } from '@autotube/llm';
import { promptEngine } from '@autotube/prompt-engine';
import type { ChannelConfig, ScriptDTO, ScriptScene, ScriptVariant, VideoFormat } from '@autotube/shared';
import {
  buildChannelPromptContext,
  buildLongDurationHint,
  buildLongSceneCountHint,
  buildLongWordsPerSceneHint,
  getRetentionScriptHints,
  applyVisualSourceToScenes,
  getScriptBodyPipelineHints,
  getStockVisualScriptHints,
  getTeaserPipelineHints,
  getThumbnailPipelineHints,
  resolveVisualSourceMode,
  clampYouTubeTitle,
  formatYouTubeShortTitle,
  youtubeLongTitleMaxForShortParts,
  youtubeShortsTitleBudget,
} from '@autotube/shared';
import { buildHookScene } from './assemble.js';
import { generateChunkedScript } from './chunked.js';
import { isScriptValidationError } from './errors.js';
import {
  buildTeaserCtaHint,
  buildTeaserHookHint,
  ensureTeaserScriptShape,
  hasTeaserCta,
  hasTeaserHook,
} from './fix-teaser-hook.js';
import { generateMonolithicScript } from './monolithic.js';
import { countWords, normalizeScenes, parseRawScenes, resolveScriptGenerationMode, sceneOptions } from './utils.js';

function finalizeGeneratedTitle(title: string, format: VideoFormat, config: ChannelConfig): string {
  if (format === 'shorts') return formatYouTubeShortTitle(title);
  // Con Shorts desde el largo: título corto para que «… — Parte N/M #Shorts» quepa entero.
  if (config.publishYoutubeShorts === true) {
    return clampYouTubeTitle(title, 'Sin título', youtubeLongTitleMaxForShortParts());
  }
  return clampYouTubeTitle(title);
}

function limitScenes(scenes: ScriptScene[], format: VideoFormat, config: ChannelConfig): ScriptScene[] {
  return normalizeScenes(scenes).slice(0, getMaxScenes(format, sceneOptions(config)));
}

function toVariant(
  key: 'A' | 'B',
  data: { hook: string; scenes: ScriptScene[] },
  format: VideoFormat,
  config: ChannelConfig,
): ScriptVariant {
  const scenes = applyVisualSourceToScenes(
    limitScenes(data.scenes, format, config),
    config,
  );
  return {
    variantId: key,
    hook: data.hook,
    hookVariant: key,
    scenes,
    estimatedDurationSec: scenes.reduce((s, sc) => s + sc.durationSec, 0),
  };
}

function parseVariant(raw: Record<string, unknown>): { hook: string; scenes: ScriptScene[] } {
  const scenesRaw = extractScenes(raw);
  return {
    hook: String(raw.hook ?? ''),
    scenes: parseRawScenes(scenesRaw),
  };
}

function buildLongPromptExtras(config: ChannelConfig, format: VideoFormat): string {
  if (format !== 'long') return '';
  const sceneOpts = sceneOptions(config);
  return (
    `\n\n${buildLongDurationHint(config)}` +
    `\n\n${buildLongSceneCountHint(config, {
      minScenes: getMinScenes(format, sceneOpts),
      maxScenes: getMaxScenes(format, sceneOpts),
    })}` +
    `\n\n${buildLongWordsPerSceneHint()}`
  );
}

function logScriptGenerationStart(config: ChannelConfig): void {
  const apiLabel = getActiveLlmLabel();
  const mode = resolveScriptGenerationMode(config);
  console.info(
    `[script] generate_script — ${apiLabel}, modo ${mode}` +
      (isScriptDevMode() ? ', dev económico' : ''),
  );
}

async function generateLongScript(params: {
  config: ChannelConfig;
  idea: { title: string; hook: string; angle: string };
  promptContent: string;
  channelContext: string;
}) {
  const { config, idea, promptContent, channelContext } = params;

  try {
    const result = await generateChunkedScript({ idea, config, channelContext });
    const bodyScenes = result.scenes.slice(1);
    const outlineForHook = {
      title: result.title,
      description: result.description,
      tags: result.tags,
      hookA: result.hookA,
      hookB: result.hookB,
      hookVisualPrompt: result.hookVisualPrompt,
      totalScenes: result.scenes.length,
      sections: [],
    };
    return {
      title: result.title,
      description: result.description,
      tags: result.tags,
      variantA: {
        hook: result.hookA,
        scenes: limitScenes(
          [buildHookScene(outlineForHook, result.hookA), ...bodyScenes],
          'long',
          config,
        ),
      },
      variantB: {
        hook: result.hookB,
        scenes: limitScenes(
          [buildHookScene(outlineForHook, result.hookB), ...bodyScenes],
          'long',
          config,
        ),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isScriptValidationError(err)) {
      throw err;
    }
    if (isScriptDevMode()) {
      console.warn(`[script] Modo chunked falló (${msg}); sin fallback monolithic en dev`);
      throw err;
    }
    const allowFallback = loadConfig().SCRIPT_MONOLITHIC_FALLBACK === true;
    if (!allowFallback) {
      throw err;
    }
    console.warn(`[script] Modo chunked falló (${msg}), fallback a monolithic (máx 2 intentos)…`);
  }

  const parsed = await generateMonolithicScript(promptContent, config.language, 'long', config, {
    fromChunkedFallback: true,
  });
  return {
    title: parsed.title,
    description: parsed.description,
    tags: parsed.tags,
    variantA: parseVariant(parsed.variantA),
    variantB: parseVariant(parsed.variantB),
  };
}

export async function generateScript(params: {
  channelId: string;
  pipelineRunId: string;
  config: ChannelConfig;
  idea: { title: string; hook: string; angle: string };
}): Promise<ScriptDTO> {
  logScriptGenerationStart(params.config);
  const abPick = Math.random() < 0.5 ? 'A' : 'B';
  const format = params.config.videoFormat;

  const rendered = await promptEngine.render({
    channelId: params.channelId,
    type: 'script_generation',
    variables: {
      format: params.config.videoFormat,
      title: params.idea.title,
      hook: params.idea.hook,
      angle: params.idea.angle,
      language: params.config.language,
    },
    abVariant: abPick,
  });

  let promptContent = rendered.content + buildChannelPromptContext(params.config);
  promptContent += buildLongPromptExtras(params.config, format);
  if (params.config.retentionMode) {
    promptContent += `\n\n${getRetentionScriptHints(format)}`;
  }
  const visualMode = resolveVisualSourceMode(params.config);
  promptContent += getStockVisualScriptHints(visualMode);
  promptContent += `\n\n${getScriptBodyPipelineHints(params.config, visualMode)}`;
  promptContent += getThumbnailPipelineHints(params.config);

  const channelContext = buildChannelPromptContext(params.config);

  let scriptData: {
    title: string;
    description: string;
    tags: string[];
    variantA: { hook: string; scenes: ScriptScene[] };
    variantB: { hook: string; scenes: ScriptScene[] };
  };

  if (format === 'long' && resolveScriptGenerationMode(params.config) === 'chunked') {
    scriptData = await generateLongScript({
      config: params.config,
      idea: params.idea,
      promptContent,
      channelContext,
    });
  } else {
    const parsed = await generateMonolithicScript(
      promptContent,
      params.config.language,
      format,
      params.config,
    );
    scriptData = {
      title: parsed.title,
      description: parsed.description,
      tags: parsed.tags,
      variantA: parseVariant(parsed.variantA),
      variantB: parseVariant(parsed.variantB),
    };
  }

  scriptData = {
    ...scriptData,
    title: finalizeGeneratedTitle(scriptData.title, format, params.config),
  };

  const variantA = toVariant('A', scriptData.variantA, format, params.config);
  const variantB = toVariant('B', scriptData.variantB, format, params.config);
  const selectedVariant = abPick === 'A' ? variantA : variantB;
  const alternateVariant = abPick === 'A' ? variantB : variantA;

  await prisma.script.create({
    data: {
      pipelineRunId: params.pipelineRunId,
      title: scriptData.title,
      description: scriptData.description,
      tags: scriptData.tags,
      selectedVariant: selectedVariant as object,
      alternateVariant: alternateVariant as object,
      hookVariantUsed: abPick,
    },
  });

  if (rendered.variantId) {
    await promptEngine.recordAbResult({
      promptVersionId: rendered.promptVersionId,
      variantId: rendered.variantId,
      pipelineRunId: params.pipelineRunId,
      metric: 'script_generated',
      value: 1,
    });
  }

  return {
    title: scriptData.title,
    description: scriptData.description,
    tags: scriptData.tags,
    selectedVariant,
    alternateVariant,
  };
}

export interface TeaserScriptResult {
  title: string;
  description: string;
  tags: string[];
  variant: ScriptVariant;
}

function teaserSystemHint(language: string, config: ChannelConfig): string {
  const visualMode = resolveVisualSourceMode(config);
  if (language === 'es' || language.startsWith('es-')) {
    return (
      'OBLIGATORIO: guion teaser en español para un Short vertical (30-45s). ' +
      'EXACTAMENTE 3-4 escenas. Máx 12 palabras por escena. ' +
      'Escena 1 = gancho impactante <3s (pregunta o dato imposible). ' +
      'Ejemplos escena 1 válidos: "¿Sabías que 2.400 millones desaparecieron en 48 horas?", ' +
      '"Nadie te contó este detalle del escándalo…", "¿Y si todo lo que creías fuera falso?". ' +
      'Escenas 2-3 = un solo dato sorprendente del tema (NO resumir todo el vídeo largo). ' +
      'Escena final = CTA que remite al vídeo completo ("Mira el vídeo completo", "La historia entera en el canal", etc.). ' +
      'JSON válido con title, description, tags, hook y scenes[].\n\n' +
      getTeaserPipelineHints(config, visualMode)
    );
  }
  return (
    `Teaser short script (30-45s). 3-4 scenes. Final scene CTA to full video. Valid JSON.\n\n` +
    getTeaserPipelineHints(config, visualMode)
  );
}

function buildMockTeaserScript(longVideo: {
  title: string;
  description: string;
  hook: string;
}): TeaserScriptResult {
  const scenes = parseRawScenes([
    {
      narration: longVideo.hook.includes('?') ? longVideo.hook : `¿Sabías que ${longVideo.hook}?`,
      visualPrompt: 'Dramatic close-up with bold text overlay, vertical 9:16 documentary style',
      durationSec: 3,
    },
    {
      narration: 'Un solo dato demuestra por qué este caso sigue dando que hablar.',
      visualPrompt: 'Documentary B-roll with highlighted statistics on screen, vertical frame',
      durationSec: 5,
    },
    {
      narration: 'Mira el vídeo completo en el canal para la historia entera.',
      visualPrompt: 'Call-to-action end card pointing to full video, vertical mobile layout',
      durationSec: 4,
    },
  ]);
  const variant: ScriptVariant = {
    variantId: 'teaser',
    hook: scenes[0]!.narration,
    hookVariant: 'A',
    scenes,
    estimatedDurationSec: scenes.reduce((s, sc) => s + sc.durationSec, 0),
  };
  const shortTitle = formatYouTubeShortTitle(`${longVideo.title} — Teaser`);
  return {
    title: shortTitle,
    description: `${longVideo.description.slice(0, 200)}\n\n#Shorts`,
    tags: ['Shorts', 'teaser'],
    variant,
  };
}

function validateTeaserScript(scenes: ScriptScene[]): string | null {
  if (scenes.length < 3 || scenes.length > 5) {
    return `Teaser debe tener 3-5 escenas (tiene ${scenes.length})`;
  }
  const first = scenes[0]!;
  const firstWords = countWords(first.narration);
  if (firstWords > 12) {
    return `Gancho demasiado largo (${firstWords} palabras, máx 12)`;
  }
  if (!hasTeaserHook(first.narration)) {
    return 'Escena 1 debe ser gancho con pregunta o dato impactante';
  }
  const last = scenes[scenes.length - 1]!;
  if (!hasTeaserCta(last.narration)) {
    return 'Escena final debe invitar a ver el vídeo completo en el canal';
  }
  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  if (totalWords > 80) {
    return `Teaser demasiado largo (${totalWords} palabras, máx ~80)`;
  }
  return null;
}

function buildTeaserCorrection(validationError: string, scenes: ScriptScene[], attempt: number): string {
  let correction = `\n\n⚠️ CORRECCIÓN OBLIGATORIA (intento ${attempt} rechazado): ${validationError}.\n`;
  if (scenes[0] && validationError.includes('Escena 1')) {
    correction += buildTeaserHookHint(scenes[0]) + '\n';
  }
  if (scenes.length > 0 && validationError.includes('Escena final')) {
    correction += buildTeaserCtaHint(scenes[scenes.length - 1]!) + '\n';
  }
  correction += 'Reescribe el teaser completo cumpliendo estas reglas antes de responder.\n';
  return correction;
}

function finalizeTeaserResult(
  parsed: ReturnType<typeof extractScriptResponse>,
  variantData: { hook: string; scenes: ScriptScene[] },
  scenes: ScriptScene[],
  config: ChannelConfig,
): TeaserScriptResult {
  const withVisualSource = applyVisualSourceToScenes(normalizeScenes(scenes), config);
  const variant: ScriptVariant = {
    variantId: 'teaser',
    hook: variantData.hook || parsed.title,
    hookVariant: 'A',
    scenes: withVisualSource,
    estimatedDurationSec: withVisualSource.reduce((s, sc) => s + sc.durationSec, 0),
  };

  const shortTitle = formatYouTubeShortTitle(parsed.title);
  const shortDescription = parsed.description.includes('#Shorts')
    ? parsed.description
    : `${parsed.description}\n\n#Shorts`;

  console.info(
    `[teaser-script] Generated ${withVisualSource.length} scenes, ` +
      `${withVisualSource.reduce((n, s) => n + countWords(s.narration), 0)} words`,
  );

  return {
    title: shortTitle,
    description: shortDescription,
    tags: parsed.tags.includes('Shorts') ? parsed.tags : [...parsed.tags, 'Shorts'],
    variant,
  };
}

export async function generateTeaserScript(params: {
  config: ChannelConfig;
  longVideo: { title: string; description: string; hook: string; angle: string };
  /** Optional hint to force a distinct angle when generating several teasers per video. */
  variationHint?: string;
}): Promise<TeaserScriptResult> {
  const { config, longVideo, variationHint } = params;
  if (isLlmMockMode()) {
    console.info('[teaser-script] MOCK — teaser válido sin coste API');
    return buildMockTeaserScript(longVideo);
  }

  const llm = getLlmClient();
  const maxScenes = 4;

  const variationLine = variationHint
    ? `\nENFOQUE ÚNICO para este Short (debe ser claramente distinto de otros teasers del mismo vídeo): ${variationHint}\n` +
      `Usa un gancho, un dato y un título completamente diferentes a los que usarías para otros ángulos.\n`
    : '';

  const baseUserPrompt =
    `Genera un guion TEASER (Short vertical 30-45s) para el mismo tema que este vídeo largo.\n` +
    `NO repitas el guion largo ni lo resumas escena a escena: solo un gancho + un dato + CTA al vídeo completo.\n\n` +
    `Título del vídeo largo: ${longVideo.title}\n` +
    `Gancho del vídeo largo: ${longVideo.hook}\n` +
    `Ángulo: ${longVideo.angle}\n` +
    `Descripción (contexto): ${longVideo.description.slice(0, 400)}\n` +
    variationLine +
    buildChannelPromptContext(config) +
    getStockVisualScriptHints(resolveVisualSourceMode(config)) +
    `\n\nResponde JSON con: title (título corto y completo del Short, distinto del largo, máx ${youtubeShortsTitleBudget()} caracteres, sin cortar palabras a medias), description, tags[], hook, scenes[{narration, visualPrompt, stockQuery, durationSec}].`;

  let lastError: string | null = null;
  let lastParsed: ReturnType<typeof extractScriptResponse> | null = null;
  let lastScenes: ScriptScene[] = [];
  let userPrompt = baseUserPrompt;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let raw: unknown;
    try {
      raw = await llm.completeJson<unknown>(userPrompt, teaserSystemHint(config.language, config), {
        maxTokens: 1500,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[teaser-script] LLM attempt ${attempt}/3 failed: ${lastError}`);
      continue;
    }

    let parsed: ReturnType<typeof extractScriptResponse>;
    try {
      parsed = extractScriptResponse(raw);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }

    const variantData = parseVariant(parsed.variantA);
    let scenes = normalizeScenes(variantData.scenes).slice(0, maxScenes);
    lastParsed = parsed;
    lastScenes = scenes;

    let validationError = validateTeaserScript(scenes);
    if (validationError && attempt < 3) {
      if (validationError.includes('Escena 1') || validationError.includes('Escena final')) {
        scenes = await ensureTeaserScriptShape({
          scenes,
          config,
          longVideoTitle: longVideo.title,
        });
        validationError = validateTeaserScript(scenes);
        if (!validationError) {
          console.info(`[teaser-script] Auto-fix OK en intento ${attempt}/3`);
          return finalizeTeaserResult(parsed, variantData, scenes, config);
        }
      }
      lastError = validationError;
      console.warn(`[teaser-script] Attempt ${attempt}/3 rejected: ${validationError}`);
      userPrompt = baseUserPrompt + buildTeaserCorrection(validationError, scenes, attempt);
      continue;
    }

    if (!validationError) {
      return finalizeTeaserResult(parsed, variantData, scenes, config);
    }

    lastError = validationError;
    console.warn(`[teaser-script] Attempt ${attempt}/3 rejected: ${validationError}`);
    userPrompt = baseUserPrompt + buildTeaserCorrection(validationError, scenes, attempt);
  }

  if (lastParsed && lastScenes.length > 0) {
    console.warn('[teaser-script] Último recurso: auto-fix programático del teaser…');
    const fixed = await ensureTeaserScriptShape({
      scenes: lastScenes,
      config,
      longVideoTitle: longVideo.title,
      forceProgrammatic: true,
    });
    const fixError = validateTeaserScript(fixed);
    if (!fixError) {
      console.info('[teaser-script] Auto-fix programático OK (último recurso)');
      return finalizeTeaserResult(lastParsed, parseVariant(lastParsed.variantA), fixed, config);
    }
    lastError = fixError;
  }

  throw new Error(
    `No se pudo generar un teaser válido tras 3 intentos y auto-fix: ${lastError ?? 'error desconocido'}`,
  );
}
