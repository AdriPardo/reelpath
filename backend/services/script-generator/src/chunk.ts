import { extractScenes } from '@autotube/llm';
import { getLlmClient } from '@autotube/llm';
import type { ChannelConfig, ScriptScene } from '@autotube/shared';
import {
  buildLongWordsPerSceneHint,
  getLongWordsPerSceneRange,
  getVisualPromptGenerationRules,
  LONG_SCENE_WORDS_HARD_MIN,
  LONG_SCENE_WORDS_MIN,
  resolveVisualSourceMode,
} from '@autotube/shared';
import type { ScriptOutline, ScriptOutlineSection } from './types.js';
import { validateChunkScenes } from './validate.js';
import { countWords, normalizeScenes, parseRawScenes, sceneWordSummary } from './utils.js';
import { fixChunkScenesProgrammatic } from './programmatic.js';

const MAX_CHUNK_RETRIES = 2;

function chunkSystemHint(language: string, config: ChannelConfig): string {
  const retentionNote =
    config.retentionMode
      ? ' Si es el último bloque: ESCENA FINAL con pregunta, teaser o cliffhanger obligatorio.'
      : '';
  const visualMode = resolveVisualSourceMode(config);
  if (language === 'es' || language.startsWith('es-')) {
    return (
      'Guionista de documentales investigativos en español (estilo El Fraude Silencioso). ' +
      'Responde SOLO JSON válido en español oral para locución. ' +
      `Cada narration del bloque: ${getLongWordsPerSceneRange()} palabras (mínimo ${LONG_SCENE_WORDS_HARD_MIN}). ` +
      'Incluye datos concretos: nombres, fechas, cifras, citas documentadas. ' +
      'PROHIBIDO estilo Shorts. PROHIBIDO "hoy vamos a hablar de". ' +
      `Visuales según modo ${visualMode}: sigue las reglas de visualPrompt/stockQuery del usuario. ` +
      'Mantén continuidad con el contexto previo y la frase puente indicada.' +
      retentionNote
    );
  }
  return (
    `Documentary script chunk writer. Valid JSON only. Visual mode: ${visualMode}. ` +
    'Follow visualPrompt/stockQuery rules in the user message.'
  );
}

function formatPreviousContext(scenes: ScriptScene[]): string {
  if (scenes.length === 0) return '(Inicio del cuerpo del guion — escena 1 ya está definida como gancho.)';
  const last = scenes[scenes.length - 1]!;
  return (
    `Última escena generada (escena ${last.index + 1}):\n` +
    `narration: "${last.narration}"\n` +
    `visualPrompt: "${last.visualPrompt}"`
  );
}

function buildChunkPrompt(params: {
  outline: ScriptOutline;
  section: ScriptOutlineSection;
  sectionIndex: number;
  totalSections: number;
  previousScenes: ScriptScene[];
  transitionFromPrevious?: string;
  channelContext: string;
  config: ChannelConfig;
  wordBudgetHint?: string;
}): string {
  const {
    outline,
    section,
    sectionIndex,
    totalSections,
    previousScenes,
    transitionFromPrevious,
    channelContext,
    config,
    wordBudgetHint,
  } = params;
  const range = getLongWordsPerSceneRange();
  const startSceneNum = previousScenes.length + 2;
  const isLastSection = sectionIndex === totalSections - 1;
  const visualMode = resolveVisualSourceMode(config);
  const finalSceneRule = isLastSection
    ? config.retentionMode
      ? `- ESCENA FINAL (OBLIGATORIO modo retención): la última escena DEBE terminar con pregunta abierta, teaser de continuación o cliffhanger.\n` +
        `  Ejemplos válidos: "¿Y si todo esto fuera solo el comienzo?", "Pero lo que viene después nadie lo esperaba…", "La pregunta que queda es: ¿quién tenía la razón?"\n` +
        `  PROHIBIDO despedida genérica ("gracias por ver").\n`
      : `- Última escena del guion: cierre memorable con reflexión\n`
    : section.transitionToNext
      ? `- La última escena debe preparar esta transición: "${section.transitionToNext}"\n`
      : '';

  return (
    `Genera SOLO las escenas del BLOQUE ${sectionIndex + 1}/${totalSections} del guion documental.\n\n` +
    `Título del vídeo: ${outline.title}\n` +
    `Gancho escena 1 (YA DEFINIDO, no regenerar): "${outline.hookA}"\n\n` +
    `OUTLINE COMPLETO:\n` +
    outline.sections
      .map(
        (s, i) =>
          `${i + 1}. ${s.title} (${s.sceneCount} escenas): ${s.summary}` +
          (s.transitionToNext ? ` → Puente: "${s.transitionToNext}"` : ''),
      )
      .join('\n') +
    `\n\nBLOQUE ACTUAL — "${section.title}":\n` +
    `Resumen: ${section.summary}\n` +
    `Escenas a generar: EXACTAMENTE ${section.sceneCount}\n` +
    `Numeración global: escenas ${startSceneNum} a ${startSceneNum + section.sceneCount - 1}\n` +
    (transitionFromPrevious
      ? `\nFRASE PUENTE desde bloque anterior (integrar al inicio del bloque): "${transitionFromPrevious}"\n`
      : '') +
    `\nCONTEXTO PREVIO:\n${formatPreviousContext(previousScenes)}\n\n` +
    `REGLAS:\n` +
    `- EXACTAMENTE ${section.sceneCount} escenas en el array "scenes"\n` +
    `- Cada narration: ${range} palabras (mínimo ${LONG_SCENE_WORDS_HARD_MIN})\n` +
    `- Incluye en cada escena al menos un dato concreto: nombre, fecha, cifra o cita\n` +
    `- ${getVisualPromptGenerationRules(visualMode).replace(/\n/g, '\n  ')}\n` +
    `- NO repitas el gancho ni escenas ya escritas\n` +
    `- Hilado: la primera escena del bloque debe fluir desde el contexto previo\n` +
    finalSceneRule +
    `\n${buildLongWordsPerSceneHint()}\n` +
    (wordBudgetHint ? `\n${wordBudgetHint}\n` : '') +
    channelContext +
    `\n\nJSON: { "scenes": [{ "narration": "...", "visualPrompt": "...", "stockQuery": "optional 1-3 EN words", "durationSec": 40 }] }`
  );
}

function buildChunkCorrection(
  error: string,
  scenes: ScriptScene[],
  expectedCount: number,
  config: ChannelConfig,
): string {
  const range = getLongWordsPerSceneRange();
  const minWordsPerScene = LONG_SCENE_WORDS_MIN;
  const sectionTargetWords = expectedCount * minWordsPerScene;
  const sectionWords = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const sectionDeficit = Math.max(0, sectionTargetWords - sectionWords);

  let correction = `\n\n⚠️ CORRECCIÓN OBLIGATORIA: ${error}\n`;
  correction +=
    `Debes generar EXACTAMENTE ${expectedCount} escenas con ${range} palabras cada una ` +
    `(objetivo del bloque: ~${sectionTargetWords} palabras).\n`;
  if (sectionDeficit > 0) {
    correction += `Este bloque necesita ~${sectionDeficit} palabras más en total para alcanzar la duración mínima del vídeo.\n`;
  }
  if (scenes.length > 0) {
    correction += 'Escenas actuales demasiado cortas:\n';
    for (const s of scenes) {
      const words = countWords(s.narration);
      if (words < LONG_SCENE_WORDS_MIN) {
        const need = LONG_SCENE_WORDS_MIN - words;
        correction += `- ${words} palabras → expande a mínimo ${LONG_SCENE_WORDS_MIN} (faltan ${need} en esta escena)\n`;
      }
    }
  }
  return correction;
}

export async function generateChunk(params: {
  outline: ScriptOutline;
  section: ScriptOutlineSection;
  sectionIndex: number;
  previousScenes: ScriptScene[];
  transitionFromPrevious?: string;
  config: ChannelConfig;
  channelContext: string;
  cumulativeWords?: number;
  targetTotalWords?: number;
}): Promise<ScriptScene[]> {
  const { outline, section, sectionIndex, config, channelContext, cumulativeWords, targetTotalWords } = params;
  const llm = getLlmClient();
  const totalSections = outline.sections.length;

  let wordBudgetHint: string | undefined;
  if (cumulativeWords != null && targetTotalWords != null) {
    const remainingSections = outline.sections.slice(sectionIndex);
    const remainingScenes = remainingSections.reduce((sum, s) => sum + s.sceneCount, 0);
    const wordsNeeded = Math.max(0, targetTotalWords - cumulativeWords);
    const wordsPerScene = remainingScenes > 0 ? Math.ceil(wordsNeeded / remainingScenes) : LONG_SCENE_WORDS_MIN;
    if (wordsPerScene > LONG_SCENE_WORDS_MIN) {
      wordBudgetHint =
        `RITMO NARRATIVO: llevas ${cumulativeWords} palabras acumuladas; objetivo total ~${targetTotalWords}. ` +
        `Este bloque debe aportar ~${wordsNeeded} palabras (~${wordsPerScene} por escena) para no quedarte corto.`;
    }
  }

  let userContent = buildChunkPrompt({
    ...params,
    totalSections,
    config,
    wordBudgetHint,
  });
  const system = chunkSystemHint(config.language, config);
  let lastError: string | null = null;
  let lastScenes: ScriptScene[] = [];

  for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    let raw: unknown;
    try {
      raw = await llm.completeJson<unknown>(userContent, system, { maxTokens: 4000 });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `[script] Chunk ${sectionIndex + 1}/${totalSections} LLM attempt ${attempt}/${MAX_CHUNK_RETRIES} failed: ${lastError}`,
      );
      continue;
    }

    let scenes: ScriptScene[];
    try {
      if (typeof raw !== 'object' || raw === null) throw new Error('Respuesta no es objeto');
      const scenesRaw = extractScenes(raw as Record<string, unknown>);
      scenes = normalizeScenes(parseRawScenes(scenesRaw));
      lastScenes = scenes;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `[script] Chunk ${sectionIndex + 1}/${totalSections} parse attempt ${attempt}/${MAX_CHUNK_RETRIES} failed: ${lastError}`,
      );
      continue;
    }

    const validationError = validateChunkScenes(scenes, section.sceneCount, config);
    if (!validationError) {
      console.info(
        `[script] Chunk ${sectionIndex + 1}/${totalSections}: ${sceneWordSummary(scenes)}`,
      );
      return scenes;
    }

    const programmatic = fixChunkScenesProgrammatic(scenes, section.sceneCount);
    const programmaticError = validateChunkScenes(programmatic, section.sceneCount, config);
    if (!programmaticError) {
      console.info(
        `[script] Chunk ${sectionIndex + 1}/${totalSections} corregido localmente: ${sceneWordSummary(programmatic)}`,
      );
      return programmatic;
    }

    lastError = validationError;
    console.warn(
      `[script] Chunk ${sectionIndex + 1}/${totalSections} attempt ${attempt}/${MAX_CHUNK_RETRIES} rejected: ${validationError}`,
    );
    if (attempt < MAX_CHUNK_RETRIES) {
      userContent += buildChunkCorrection(validationError, scenes, section.sceneCount, config);
    }
  }

  if (lastScenes.length > 0) {
    const lastResort = fixChunkScenesProgrammatic(lastScenes, section.sceneCount);
    const lastResortError = validateChunkScenes(lastResort, section.sceneCount, config);
    if (!lastResortError) {
      console.info(
        `[script] Chunk ${sectionIndex + 1}/${totalSections} último recurso programático OK`,
      );
      return lastResort;
    }
  }

  throw new Error(
    `Bloque ${sectionIndex + 1} ("${section.title}") inválido tras ${MAX_CHUNK_RETRIES} intentos: ${lastError ?? 'unknown'}`,
  );
}
