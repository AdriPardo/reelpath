import type { ChannelConfig } from './types.js';

/** Default long-form floor: 8 minutes (acceptable minimum). */
export const DEFAULT_TARGET_DURATION_MIN_SEC = 480;
/** Default long-form target: 15 minutes. */
export const DEFAULT_TARGET_DURATION_MAX_SEC = 900;

/** Spoken Spanish documentary pace used for script word-count validation. */
export const WORDS_PER_MINUTE_ESTIMATE = 135;

export function getTargetDurationMinSec(
  config?: Pick<ChannelConfig, 'targetDurationMinSec' | 'videoFormat'>,
): number {
  if (config?.videoFormat === 'shorts') return 30;
  return config?.targetDurationMinSec ?? DEFAULT_TARGET_DURATION_MIN_SEC;
}

export function getTargetDurationMaxSec(
  config?: Pick<ChannelConfig, 'targetDurationMaxSec' | 'videoFormat'>,
): number {
  if (config?.videoFormat === 'shorts') return 60;
  return config?.targetDurationMaxSec ?? DEFAULT_TARGET_DURATION_MAX_SEC;
}

export function formatDurationRange(minSec: number, maxSec: number): string {
  const minMin = Math.round(minSec / 60);
  const maxMin = Math.round(maxSec / 60);
  return minMin === maxMin ? `${minMin} minutos` : `${minMin} a ${maxMin} minutos`;
}

export function formatDurationMinutes(seconds: number): string {
  const minutes = seconds / 60;
  return minutes >= 10 ? String(Math.round(minutes)) : (Math.round(minutes * 10) / 10).toFixed(1);
}

/** Estimated spoken duration from word count at documentary pace. */
export function estimateDurationSecFromWords(wordCount: number): number {
  return (wordCount / WORDS_PER_MINUTE_ESTIMATE) * 60;
}

export function getMinScriptWords(
  config: Pick<ChannelConfig, 'targetDurationMinSec' | 'videoFormat'>,
): number {
  if (config.videoFormat === 'shorts') return 40;
  const minSec = getTargetDurationMinSec(config);
  return Math.floor((minSec / 60) * WORDS_PER_MINUTE_ESTIMATE);
}

/** Target word count for generation (min + margin so validation passes after trimming). */
export function getTargetScriptWords(
  config: Pick<ChannelConfig, 'targetDurationMinSec' | 'videoFormat'>,
  marginPercent = 10,
): number {
  const minWords = getMinScriptWords(config);
  return Math.ceil(minWords * (1 + marginPercent / 100));
}

export function getScriptWordDeficit(
  scenes: { narration: string }[],
  config: Pick<ChannelConfig, 'targetDurationMinSec' | 'videoFormat'>,
): number {
  const totalWords = scenes.reduce(
    (sum, s) => sum + s.narration.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  return Math.max(0, getMinScriptWords(config) - totalWords);
}

/** Target words per body scene (scenes 2+) for long-form documentary scripts. */
export const LONG_SCENE_WORDS_MIN = 65;
export const LONG_SCENE_WORDS_MAX = 85;
/** Hard reject threshold for body scenes below this count. */
export const LONG_SCENE_WORDS_HARD_MIN = 55;
/** Absolute floor — more than this many body scenes below it triggers rejection. */
export const LONG_SCENE_WORDS_ABSOLUTE_MIN = 40;
/** Max words for scene 1 hook (pattern-interrupt). */
export const LONG_HOOK_MAX_WORDS = 20;
/** Max body scenes allowed below LONG_SCENE_WORDS_HARD_MIN before rejection. */
export const LONG_SHORT_BODY_SCENES_TOLERANCE = 2;

/** Words per scene range for long-form documentary scripts. */
export function getLongWordsPerSceneRange(): string {
  return `${LONG_SCENE_WORDS_MIN}-${LONG_SCENE_WORDS_MAX}`;
}

export function buildLongDurationHint(config: ChannelConfig): string {
  const minSec = getTargetDurationMinSec(config);
  const maxSec = getTargetDurationMaxSec(config);
  const range = formatDurationRange(minSec, maxSec);
  const minWords = getMinScriptWords(config);
  return (
    `DURACIÓN OBJETIVO: vídeo documental de ${range} (~${minWords}+ palabras totales). ` +
    `Desarrolla la historia con profundidad — no resumir ni acortar.`
  );
}

/** Scene-count guidance for long-form scripts (overrides stale DB prompts that ask for 10 scenes). */
export function buildLongSceneCountHint(
  config: ChannelConfig,
  options?: { minScenes?: number; maxScenes?: number },
): string {
  const minScenes = options?.minScenes ?? 12;
  const maxScenes = options?.maxScenes ?? 20;
  const targetScenes = Math.min(16, maxScenes);
  const minSec = getTargetDurationMinSec(config);
  const maxSec = getTargetDurationMaxSec(config);
  const range = formatDurationRange(minSec, maxSec);
  const minWords = getMinScriptWords(config);
  return (
    `DURACIÓN Y ESCENAS (documental ${range}): el requisito principal es superar ${formatDurationMinutes(minSec)} minutos (~${minWords}+ palabras totales). ` +
    `Genera entre ${minScenes} y ${maxScenes} escenas en "scenes" (objetivo ideal: ${targetScenes}). ` +
    `14-16 escenas con ${getLongWordsPerSceneRange()} palabras por narration (escenas 2+) es válido si alcanza la duración mínima. ` +
    `PROHIBIDO guiones cortos de 10 escenas u otros formatos antiguos. ` +
    `Si otra instrucción pide "10 escenas" o "exactamente 10", IGNÓRALA.`
  );
}

/** Scene-count rules for chunked outline planning (hook is separate from section sceneCount). */
export function buildOutlineSceneCountHint(options: {
  minScenes: number;
  maxScenes: number;
  targetScenes: number;
}): string {
  const { minScenes, maxScenes, targetScenes } = options;
  const bodyTarget = targetScenes - 1;
  return (
    `ESCENAS DEL OUTLINE (el gancho es escena 1 aparte — NO va en sceneCount):\n` +
    `- totalScenes = 1 (gancho) + suma de sceneCount de TODAS las secciones\n` +
    `- Rango flexible: ${minScenes}-${maxScenes} escenas totales; 14-16 es válido si la narración supera 8 minutos\n` +
    `- Objetivo: ${targetScenes} totales = 1 gancho + ${bodyTarget} escenas repartidas en 3-4 secciones (≥2 por sección)\n` +
    `- Los bloques generan solo escenas 2 en adelante; la duración total importa más que el conteo exacto`
  );
}

/** Example section sceneCounts for outline JSON (body only; +1 hook = targetScenes). */
export function exampleOutlineSectionCounts(targetScenes: number): number[] {
  const body = Math.max(12, targetScenes - 1);
  const sectionCount = body >= 16 ? 4 : 3;
  const base = Math.floor(body / sectionCount);
  const remainder = body % sectionCount;
  return Array.from({ length: sectionCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Explicit per-scene word-count rules with example (overrides stale DB prompts). */
export function buildLongWordsPerSceneHint(): string {
  const example =
    'En marzo de mil cuatrocientos noventa y dos, en los muros del palacio de Sforza, ' +
    'Leonardo da Vinci dejó una anotación que durante siglos interpretaron como un simple boceto decorativo. ' +
    'Pero el historiador Carlo Pedretti detectó en mil novecientos setenta y tres una secuencia numérica ' +
    'que coincidía con los registros de pagos del ducado milanés. Nadie había relacionado aquellas cifras ' +
    'con la desaparición de tres enviados diplomáticos enviados a Florencia ese mismo invierno. ' +
    'Los archivos vaticanos, recién digitalizados, confirmaron que el maestro conocía el contenido ' +
    'de cartas que oficialmente nunca debió leer. Ese detalle cambiaría la forma de entender ' +
    'su relación con los Medici y el verdadero alcance de su red de informantes.';
  const exampleWords = example.trim().split(/\s+/).length;
  return (
    `LONGITUD DE NARRACIÓN (CRÍTICO — CAUSA DE RECHAZO AUTOMÁTICO):\n` +
    `- ESCENA 1 únicamente: gancho corto (≤${LONG_HOOK_MAX_WORDS} palabras). Pattern-interrupt, NO contexto.\n` +
    `- ESCENAS 2 a N: CADA narration DEBE tener entre ${LONG_SCENE_WORDS_MIN} y ${LONG_SCENE_WORDS_MAX} palabras.\n` +
    `- Mínimo absoluto escenas 2+: ${LONG_SCENE_WORDS_HARD_MIN} palabras. Escenas con menos de ${LONG_SCENE_WORDS_ABSOLUTE_MIN} palabras serán RECHAZADAS.\n` +
    `- PROHIBIDO estilo Shorts (12-15 palabras/escena) en documentales largos.\n` +
    `- Ejemplo de escena 2 con ${exampleWords} palabras (válida):\n` +
    `  "${example}"`
  );
}
