import { getMaxScenes, getMinScenes, getOpenAiMaxTokens } from '@autotube/config';
import { extractScenes, extractScriptResponse } from '@autotube/llm';
import { getLlmClient } from '@autotube/llm';
import type { ChannelConfig, ScriptScene, VideoFormat } from '@autotube/shared';
import {
  getLongWordsPerSceneRange,
  formatDurationRange,
  formatDurationMinutes,
  getTargetDurationMinSec,
  getTargetDurationMaxSec,
  LONG_HOOK_MAX_WORDS,
  LONG_SCENE_WORDS_ABSOLUTE_MIN,
} from '@autotube/shared';
import {
  buildLongScriptCorrection,
  buildDurationExpansionHint,
  isFinalSceneRetentionError,
  validateLongScript,
  validateShortScript,
} from './validate.js';
import { countWords, parseRawScenes, sceneOptions } from './utils.js';
import { expandScriptToMinDuration, minimalOutline } from './assemble.js';
import { ensureFinalSceneRetention } from './fix-final-scene.js';

function longSceneTargets(format: VideoFormat, config: ChannelConfig) {
  const sceneOpts = sceneOptions(config);
  const minScenes = getMinScenes(format, sceneOpts);
  const maxScenes = getMaxScenes(format, sceneOpts);
  const targetScenes = Math.min(16, maxScenes);
  return { minScenes, maxScenes, targetScenes };
}

function languageSystemHint(language: string, format: VideoFormat, config: ChannelConfig): string {
  const retention = config.retentionMode ?? false;
  const sceneOpts = sceneOptions(config);
  const isLong = format === 'long';
  if (language === 'es' || language.startsWith('es-')) {
    const { minScenes, maxScenes, targetScenes } = longSceneTargets(format, config);
    const wordsPerScene = isLong ? getLongWordsPerSceneRange() : retention ? '12' : '14';
    const durationRange = formatDurationRange(
      getTargetDurationMinSec(config),
      getTargetDurationMaxSec(config),
    );
    const structure = isLong
      ? `Formato documental ${durationRange}. ENTRE ${minScenes} y ${maxScenes} escenas (objetivo ${targetScenes}). ` +
        `Requisito principal: superar ${formatDurationMinutes(getTargetDurationMinSec(config))} minutos de narración. ` +
        `Escena 1: gancho ≤${LONG_HOOK_MAX_WORDS} palabras. Escenas 2+: ${wordsPerScene} palabras CADA UNA (menos de ${LONG_SCENE_WORDS_ABSOLUTE_MIN} = RECHAZO). ` +
        `Arco: gancho → contexto → desarrollo → giro → legado → cierre.`
      : retention
        ? `Shorts modo retención: ${minScenes}-${maxScenes} escenas. ` +
          'Escena 1 = gancho <3s. Última = cliffhanger. Máx 12 palabras/escena.'
        : 'Arco narrativo corto: gancho → contexto → revelación. Máx 14 palabras/escena.';
    return (
      'OBLIGATORIO: guion en español oral para locución profesional. ' +
      'UNA sola curiosidad por vídeo — no listas, no datos extra. ' +
      structure +
      ' Comas para pausas. Cada narration termina con punto.'
    );
  }
  return `Language: ${language}. One curiosity per video. Format: ${format}.`;
}

function llmSystemHint(language: string, format: VideoFormat, config: ChannelConfig): string {
  const { minScenes, targetScenes } = longSceneTargets(format, config);
  const wordsPerScene = format === 'long' ? getLongWordsPerSceneRange() : config.retentionMode ? '12' : '14';
  const sceneRule =
    format === 'long'
      ? `Mínimo ${minScenes} escenas, objetivo ${targetScenes}. La duración total (>8 min) es más importante que el conteo exacto de escenas.`
      : `Entre ${minScenes} y ${getMaxScenes(format, sceneOptions(config))} escenas.`;
  const wordRule =
    format === 'long'
      ? `Escena 1 ≤${LONG_HOOK_MAX_WORDS} palabras. Escenas 2+: ${wordsPerScene} palabras obligatorias.`
      : `Narration ${wordsPerScene} palabras/escena.`;
  return `${languageSystemHint(language, format, config)} JSON válido. ${sceneRule} ${wordRule}`;
}

function longFormMaxTokens(attempt: number): number {
  const base = getOpenAiMaxTokens('long');
  if (attempt >= 3) return Math.max(base, 12000);
  if (attempt >= 2) return Math.max(base, 10000);
  return base;
}

function parseVariant(raw: Record<string, unknown>): { hook: string; scenes: ScriptScene[] } {
  const scenesRaw = extractScenes(raw);
  return {
    hook: String(raw.hook ?? ''),
    scenes: parseRawScenes(scenesRaw),
  };
}

export async function generateMonolithicScript(
  renderedContent: string,
  language: string,
  format: VideoFormat,
  config: ChannelConfig,
  options?: { fromChunkedFallback?: boolean },
): Promise<ReturnType<typeof extractScriptResponse>> {
  const llm = getLlmClient();
  const retention = config.retentionMode ?? false;
  const fromChunked = options?.fromChunkedFallback ?? false;
  const maxAttempts = format === 'long' || retention ? (fromChunked ? 2 : 3) : 1;
  let lastError: string | null = null;
  let userContent = renderedContent;
  let lastParsed: ReturnType<typeof extractScriptResponse> | null = null;
  let lastScenes: ScriptScene[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let raw: unknown;
    try {
      raw = await llm.completeJson<unknown>(
        userContent,
        llmSystemHint(language, format, config),
        { maxTokens: format === 'long' ? longFormMaxTokens(attempt) : getOpenAiMaxTokens(format) },
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[script] LLM attempt ${attempt}/${maxAttempts} failed: ${lastError}`);
      continue;
    }

    let parsed: ReturnType<typeof extractScriptResponse>;
    try {
      parsed = extractScriptResponse(raw);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `[script] Parse attempt ${attempt}/${maxAttempts} failed: ${lastError}`,
        JSON.stringify(raw).slice(0, 400),
      );
      continue;
    }

    const variantA = parseVariant(parsed.variantA);
    lastParsed = parsed;
    lastScenes = variantA.scenes;
    const validationError =
      validateLongScript(variantA.scenes, format, config) ??
      validateShortScript(variantA.scenes, format, config);

    if (!validationError) {
      console.info(
        `[script] Generated ${variantA.scenes.length} scenes, ` +
          `${variantA.scenes.reduce((n: number, s: ScriptScene) => n + countWords(s.narration), 0)} words` +
          (retention ? ' (retention)' : ''),
      );
      return parsed;
    }

    lastError = validationError;
    console.warn(`[script] Attempt ${attempt}/${maxAttempts} rejected: ${validationError}`);
    if (attempt < maxAttempts) {
      if (isFinalSceneRetentionError(validationError) && variantA.scenes.length > 0) {
        const outline = minimalOutline(parsed.title);
        const fixedScenes = await ensureFinalSceneRetention({
          scenes: variantA.scenes,
          outline,
          config,
          format,
        });
        const fixError =
          validateLongScript(fixedScenes, format, config) ??
          validateShortScript(fixedScenes, format, config);
        if (!fixError) {
          console.info('[script] Auto-fix escena final OK antes de reintento monolithic');
          return {
            ...parsed,
            variantA: { ...variantA, scenes: fixedScenes },
            variantB: { ...parseVariant(parsed.variantB), scenes: fixedScenes },
          };
        }
      }
      const correction =
        format === 'long'
          ? buildLongScriptCorrection(validationError, variantA.scenes, config, attempt) +
            (buildDurationExpansionHint(variantA.scenes, config)
              ? `\n${buildDurationExpansionHint(variantA.scenes, config)}`
              : '')
          : `\n\n⚠️ CORRECCIÓN OBLIGATORIA (intento ${attempt} rechazado): ${validationError}.\n` +
            'Corrige el guion según la validación anterior antes de responder.\n';
      userContent = renderedContent + correction;
    }
  }

  if (format === 'long' && lastParsed && lastScenes.length > 0) {
    console.warn('[script] Último recurso monolithic: expansión programática…');
    const outline = minimalOutline(lastParsed.title);
    const expanded = await expandScriptToMinDuration({
      scenes: lastScenes,
      outline,
      config,
      maxIterations: 10,
    });
    const withClosing = await ensureFinalSceneRetention({
      scenes: expanded,
      outline,
      config,
      format,
      forceProgrammatic: true,
    });
    const expansionError =
      validateLongScript(withClosing, format, config) ??
      validateShortScript(withClosing, format, config);
    if (!expansionError) {
      console.info(
        `[script] Expansión programática OK: ${withClosing.length} scenes, ` +
          `${withClosing.reduce((n: number, s: ScriptScene) => n + countWords(s.narration), 0)} words`,
      );
      return {
        ...lastParsed,
        variantA: { ...parseVariant(lastParsed.variantA), scenes: withClosing },
        variantB: {
          ...parseVariant(lastParsed.variantB),
          scenes: withClosing,
        },
      };
    }
    lastError = expansionError;
  }

  if (lastParsed && lastScenes.length > 0 && config.retentionMode) {
    console.warn('[script] Último recurso monolithic: auto-fix escena final…');
    const outline = minimalOutline(lastParsed.title);
    const fixed = await ensureFinalSceneRetention({
      scenes: lastScenes,
      outline,
      config,
      format,
      forceProgrammatic: true,
    });
    const fixError =
      validateLongScript(fixed, format, config) ?? validateShortScript(fixed, format, config);
    if (!fixError) {
      console.info('[script] Auto-fix escena final OK (último recurso monolithic)');
      return {
        ...lastParsed,
        variantA: { ...parseVariant(lastParsed.variantA), scenes: fixed },
        variantB: { ...parseVariant(lastParsed.variantB), scenes: fixed },
      };
    }
    lastError = fixError;
  }

  throw new Error(`Guion inválido tras ${maxAttempts} intentos: ${lastError ?? 'unknown'}`);
}
