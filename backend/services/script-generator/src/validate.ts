import { getMinScenes, getMaxScenes } from '@autotube/config';
import type { ChannelConfig, ScriptScene, VideoFormat } from '@autotube/shared';
import {
  getLongWordsPerSceneRange,
  getMinScriptWords,
  getTargetDurationMinSec,
  formatDurationMinutes,
  estimateDurationSecFromWords,
  LONG_HOOK_MAX_WORDS,
  LONG_SCENE_WORDS_ABSOLUTE_MIN,
  LONG_SCENE_WORDS_HARD_MIN,
  LONG_SCENE_WORDS_MIN,
  LONG_SCENE_WORDS_MAX,
  LONG_SHORT_BODY_SCENES_TOLERANCE,
} from '@autotube/shared';
import type { ScriptOutline } from './types.js';
import { countWords, sceneOptions } from './utils.js';

type ShortSceneDetail = { index: number; words: number };

/** Error message when final scene lacks retention closing (hook for auto-fix). */
export const FINAL_SCENE_RETENTION_ERROR =
  'Escena final debe cerrar con pregunta, teaser o cliffhanger (modo retención)';

/**
 * Detects retention-style closing in narration.
 * Long documentaries use a softened rule: reflective rhetorical closings also pass.
 */
export function hasRetentionClosing(narration: string, format: VideoFormat): boolean {
  const text = narration.trim();
  if (!text) return false;

  if (/[?…]/.test(text)) return true;

  const strictPatterns = [
    /\b(pr[oó]ximo|continuaci[oó]n|parte\s*2|siguiente\s+(v[ií]deo|cap[ií]tulo|episodio)|teaser)\b/i,
    /\bqu[eé]\s+pas/i,
    /\b(descubrir|descubrir[aá]s|revelar|revelaremos|responder|responderemos)\b/i,
    /\b(y\s+si|pero\s+esto\s+no\s+es\s+todo|lo\s+que\s+viene\s+despu[eé]s)\b/i,
    /\b(nadie\s+esperaba|nadie\s+imaginaba|pocos\s+saben|nadie\s+sabe)\b/i,
    /\b(te\s+invito|imagina\s+si|reflexiona|queda\s+por|a[uú]n\s+hoy)\b/i,
    /\b(la\s+historia\s+no\s+termina|el\s+misterio\s+contin[uú]a)\b/i,
    /\b(en\s+el\s+pr[oó]ximo|mantente|no\s+te\s+pierdas)\b/i,
    /\blo\s+m[aá]s\s+(oscuro|extraño|sorprendente)\b/i,
  ];
  if (strictPatterns.some((p) => p.test(text))) return true;

  // Long-form: softer closing — rhetorical reflection counts (not just Shorts cliffhangers).
  if (format === 'long') {
    const softPatterns = [
      /\b(crees\s+que|piensas\s+que|sabr[ií]as\s+que|recuerdas\s+que|conoc[ií]as)\b/i,
      /\b(pregunta\s+que|reflexi[oó]n|legado|nos\s+deja|nos\s+invita)\b/i,
      /\bqu[eé]\s+(significa|implica|oculta|esconde|revela)\b/i,
      /\b(hoy\s+sabemos|todav[ií]a\s+debate|sigue\s+sin\s+respuesta)\b/i,
    ];
    if (softPatterns.some((p) => p.test(text))) return true;
  }

  return false;
}

export function isFinalSceneRetentionError(error: string): boolean {
  return error.includes(FINAL_SCENE_RETENTION_ERROR) || error.includes('cliffhanger (modo retención)');
}

function findShortBodyScenes(scenes: ScriptScene[], minWords: number): ShortSceneDetail[] {
  return scenes
    .map((s, i) => ({ index: i + 1, words: countWords(s.narration) }))
    .filter((d) => d.index > 1 && d.words < minWords);
}

export function validateShortScript(
  scenes: ScriptScene[],
  format: VideoFormat,
  config: ChannelConfig,
): string | null {
  if (format !== 'shorts' || !config.retentionMode || scenes.length === 0) return null;
  const first = scenes[0]!;
  const words = countWords(first.narration);
  if (words > 12) {
    return `Escena 1 demasiado larga (${words} palabras, máx 12 para gancho)`;
  }
  const slowIntro =
    /^(hoy|en este|bienvenid|vamos a|te contamos|hablaremos)/i.test(first.narration.trim());
  if (slowIntro) {
    return 'Escena 1 no puede ser intro lenta — debe ser pattern-interrupt';
  }
  const hooky =
    /[?!]/.test(first.narration) ||
    /\b(nunca|imposible|secreto|nadie|olvidad|mentira|falso|ocult)/i.test(first.narration);
  if (!hooky) {
    return 'Escena 1 debe ser gancho con pregunta, dato chocante o pattern-interrupt';
  }
  return null;
}

export function validateLongScript(
  scenes: ScriptScene[],
  format: VideoFormat,
  config: ChannelConfig,
): string | null {
  if (format !== 'long') return null;
  const sceneOpts = sceneOptions(config);
  const minScenes = getMinScenes(format, sceneOpts);
  if (scenes.length < minScenes) {
    return (
      `Solo ${scenes.length} escenas (mínimo ${minScenes}, incluye escena 1 gancho + cuerpo). ` +
      `Faltan ${minScenes - scenes.length} escena(s) — revisa que el outline sume ≥${minScenes - 1} en sceneCount de secciones.`
    );
  }

  if (scenes[0]) {
    const hookWords = countWords(scenes[0].narration);
    if (hookWords > LONG_HOOK_MAX_WORDS) {
      return `Escena 1 demasiado larga (${hookWords} palabras, máx ${LONG_HOOK_MAX_WORDS} para gancho)`;
    }
  }

  const belowHardMin = findShortBodyScenes(scenes, LONG_SCENE_WORDS_HARD_MIN);
  if (belowHardMin.length > LONG_SHORT_BODY_SCENES_TOLERANCE) {
    return (
      `${belowHardMin.length} escenas (2+) con narración demasiado corta ` +
      `(mínimo ${LONG_SCENE_WORDS_HARD_MIN} palabras, objetivo ${getLongWordsPerSceneRange()})`
    );
  }

  const belowAbsolute = findShortBodyScenes(scenes, LONG_SCENE_WORDS_ABSOLUTE_MIN);
  if (belowAbsolute.length > 3) {
    return (
      `${belowAbsolute.length} escenas (2+) con narración demasiado corta ` +
      `(<${LONG_SCENE_WORDS_ABSOLUTE_MIN} palabras)`
    );
  }

  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const minWords = getMinScriptWords(config);
  const minDurationSec = getTargetDurationMinSec(config);
  const estimatedFromWords = estimateDurationSecFromWords(totalWords);
  const estimatedFromSceneDuration = scenes.reduce((sum, s) => sum + s.durationSec, 0);
  if (
    totalWords < minWords ||
    estimatedFromWords < minDurationSec ||
    estimatedFromSceneDuration < minDurationSec
  ) {
    const actualMin = formatDurationMinutes(Math.min(estimatedFromWords, estimatedFromSceneDuration));
    const requiredMin = formatDurationMinutes(minDurationSec);
    return `El guion debe superar ${requiredMin} minutos (actual: ${actualMin} min, ${totalWords} palabras)`;
  }

  const genericVisuals = scenes.filter((s) => {
    const vp = s.visualPrompt.trim();
    return vp.length < 35 || /cinematic,?\s*dramatic lighting,?\s*historical/i.test(vp);
  });
  if (genericVisuals.length > scenes.length / 2) {
    return `${genericVisuals.length} escenas con visualPrompt genérico (deben ser únicos y específicos)`;
  }

  const uniqueVisuals = new Set(scenes.map((s) => s.visualPrompt.trim().toLowerCase()));
  if (uniqueVisuals.size < Math.min(scenes.length, 6)) {
    return `visualPrompts repetidos (${uniqueVisuals.size} únicos de ${scenes.length})`;
  }

  if (config.retentionMode && scenes[0]) {
    // retentionMode on long docs: hook + micro-hooks + soft closing (rhetorical Q OK).
    // Strict Shorts-style cliffhangers are softened via hasRetentionClosing(..., 'long').
    const slowIntro =
      /^(hoy|bienvenid|en este vídeo|vamos a explorar)/i.test(scenes[0].narration.trim());
    if (slowIntro) {
      return 'Escena 1 no puede ser intro lenta en modo retención';
    }
    const hooky =
      /[?!]/.test(scenes[0].narration) ||
      /\b(nunca|imposible|secreto|nadie|olvidad|mentira|falso|ocult|paradoja|extraño)\b/i.test(
        scenes[0].narration,
      );
    if (!hooky) {
      return 'Escena 1 debe abrir con gancho (pregunta, dato imposible o pattern-interrupt)';
    }
    const last = scenes[scenes.length - 1];
    if (last && !hasRetentionClosing(last.narration, 'long')) {
      return FINAL_SCENE_RETENTION_ERROR;
    }
  }

  return null;
}

export function validateOutline(outline: ScriptOutline, config: ChannelConfig): string | null {
  const sceneOpts = sceneOptions(config);
  const minScenes = getMinScenes('long', sceneOpts);
  const maxScenes = getMaxScenes('long', sceneOpts);

  if (outline.sections.length < 3 || outline.sections.length > 5) {
    return `Outline debe tener 3-5 secciones (tiene ${outline.sections.length})`;
  }

  const bodyScenes = outline.sections.reduce((sum, s) => sum + s.sceneCount, 0);
  const total = bodyScenes + 1;
  if (total !== outline.totalScenes) {
    return (
      `totalScenes (${outline.totalScenes}) no coincide con 1 gancho + ${bodyScenes} escenas de cuerpo (= ${total}). ` +
      `Ajusta totalScenes a ${total} o reparte escenas en las secciones.`
    );
  }
  if (total < minScenes || total > maxScenes) {
    return (
      `totalScenes ${total} fuera de rango (${minScenes}-${maxScenes}). ` +
      (total < minScenes
        ? `Las secciones suman ${bodyScenes} escenas de cuerpo; necesitas al menos ${minScenes - 1} (+1 gancho).`
        : `Reduce sceneCount en las secciones (máximo ${maxScenes - 1} de cuerpo).`)
    );
  }

  for (const section of outline.sections) {
    if (section.sceneCount < 2) {
      return `Sección "${section.title}" debe tener al menos 2 escenas`;
    }
    if (!section.summary.trim()) {
      return `Sección "${section.title}" sin summary`;
    }
  }

  const lastSection = outline.sections[outline.sections.length - 1];
  if (lastSection?.transitionToNext?.trim()) {
    return 'La última sección no debe tener transitionToNext';
  }

  for (let i = 0; i < outline.sections.length - 1; i++) {
    const section = outline.sections[i]!;
    if (!section.transitionToNext?.trim()) {
      return `Sección "${section.title}" debe incluir transitionToNext para hilado`;
    }
  }

  const hookWords = countWords(outline.hookA);
  if (hookWords > LONG_HOOK_MAX_WORDS) {
    return `hookA demasiado largo (${hookWords} palabras, máx ${LONG_HOOK_MAX_WORDS})`;
  }
  if (!outline.hookVisualPrompt.trim()) {
    return 'hookVisualPrompt vacío';
  }
  if (!outline.title.trim()) {
    return 'title vacío';
  }

  return null;
}

export function validateChunkScenes(
  scenes: ScriptScene[],
  expectedCount: number,
  config: ChannelConfig,
): string | null {
  if (scenes.length !== expectedCount) {
    return `Bloque generó ${scenes.length} escenas (esperadas ${expectedCount})`;
  }

  for (let i = 0; i < scenes.length; i++) {
    const words = countWords(scenes[i]!.narration);
    if (words < LONG_SCENE_WORDS_HARD_MIN) {
      return `Escena del bloque ${i + 1}: ${words} palabras (mínimo ${LONG_SCENE_WORDS_HARD_MIN})`;
    }
    if (words < LONG_SCENE_WORDS_MIN && words >= LONG_SCENE_WORDS_HARD_MIN) {
      // tolerable en bloque individual — el ensamblado validará globalmente
    }
    if (!scenes[i]!.visualPrompt.trim()) {
      return `Escena del bloque ${i + 1} sin visualPrompt`;
    }
  }

  return null;
}

export function findShortScenesForFix(scenes: ScriptScene[]): ShortSceneDetail[] {
  return findShortBodyScenes(scenes, LONG_SCENE_WORDS_MIN);
}

/** Shortest body scenes first — for total-duration expansion when per-scene counts look OK. */
export function findScenesForDurationExpansion(scenes: ScriptScene[]): ShortSceneDetail[] {
  return scenes
    .map((s, i) => ({ index: i + 1, words: countWords(s.narration) }))
    .filter((d) => d.index > 1)
    .sort((a, b) => a.words - b.words);
}

export function buildDurationExpansionHint(
  scenes: ScriptScene[],
  config: ChannelConfig,
): string | null {
  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const minWords = getMinScriptWords(config);
  if (totalWords >= minWords) return null;

  const wordsMissing = minWords - totalWords;
  const requiredMin = formatDurationMinutes(getTargetDurationMinSec(config));
  const shortScenes = findShortScenesForFix(scenes);
  const expandTargets =
    shortScenes.length > 0 ? shortScenes : findScenesForDurationExpansion(scenes).slice(0, 4);

  let hint =
    `Faltan ${wordsMissing} palabras para superar ${requiredMin} minutos ` +
    `(actual: ${totalWords}, mínimo: ${minWords}).\n`;

  if (expandTargets.length > 0) {
    hint += `Escenas a expandir (añade contexto y detalle, no repitas ideas):\n`;
    for (const { index, words } of expandTargets.slice(0, 8)) {
      const target = Math.min(LONG_SCENE_WORDS_MAX, words + Math.ceil(wordsMissing / expandTargets.length));
      hint += `- Escena ${index}: ${words} palabras → objetivo ~${target}\n`;
    }
  }

  return hint;
}

export function buildLongScriptCorrection(
  validationError: string,
  scenes: ScriptScene[],
  config: ChannelConfig,
  attempt: number,
): string {
  const sceneOpts = sceneOptions(config);
  const minScenes = getMinScenes('long', sceneOpts);
  const sceneCount = scenes.length;
  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const minWords = getMinScriptWords(config);
  const range = getLongWordsPerSceneRange();

  let correction =
    `\n\n⚠️ CORRECCIÓN OBLIGATORIA (intento ${attempt} rechazado): ${validationError}.\n`;

  if (sceneCount < minScenes) {
    correction +=
      `Generaste solo ${sceneCount} escenas. Objetivo: ${minScenes}-${getMaxScenes('long', sceneOpts)} escenas ` +
      `con duración total superior a ${formatDurationMinutes(getTargetDurationMinSec(config))} minutos. ` +
      `Añade escenas de desarrollo, profundización y contexto sin cambiar el tema.\n`;
    return correction;
  }

  const shortBody = findShortBodyScenes(scenes, LONG_SCENE_WORDS_MIN);
  const veryShortBody = findShortBodyScenes(scenes, LONG_SCENE_WORDS_HARD_MIN);
  const targets = veryShortBody.length > 0 ? veryShortBody : shortBody;

  if (targets.length > 0 || totalWords < minWords) {
    const requiredMin = formatDurationMinutes(getTargetDurationMinSec(config));
    const wordsMissing = Math.max(0, minWords - totalWords);
    correction +=
      `LONGITUD OBLIGATORIA: escena 1 = gancho ≤${LONG_HOOK_MAX_WORDS} palabras. ` +
      `Escenas 2 a ${sceneCount}: ${range} palabras CADA UNA (mínimo ${LONG_SCENE_WORDS_HARD_MIN}).\n` +
      `Total actual: ${totalWords} palabras. Mínimo requerido: ~${minWords} palabras (>${requiredMin} minutos).\n`;
    if (wordsMissing > 0) {
      correction += `Faltan ${wordsMissing} palabras para alcanzar ${requiredMin} minutos — expande escenas existentes o añade desarrollo.\n`;
    }
    correction += `PROHIBIDO estilo Shorts (12-15 palabras/escena) — es un documental largo.\n`;

    if (targets.length > 0) {
      correction += `Escenas que debes EXPANDIR (añade contexto, detalles, consecuencias, no repitas ideas):\n`;
      for (const { index, words } of targets.slice(0, 12)) {
        correction += `- Escena ${index}: ${words} palabras → expande a mínimo ${LONG_SCENE_WORDS_MIN}\n`;
      }
      if (targets.length > 12) {
        correction += `- … y ${targets.length - 12} escenas más con el mismo problema\n`;
      }
    }
    correction += `Reescribe el guion completo cumpliendo estas longitudes antes de responder.\n`;
    return correction;
  }

  if (isFinalSceneRetentionError(validationError) && scenes.length > 0) {
    const last = scenes[scenes.length - 1]!;
    correction +=
      `\nESCENA FINAL — cierre de retención OBLIGATORIO:\n` +
      `Narración actual (inválida): "${last.narration}"\n` +
      `Debe terminar con pregunta abierta, teaser o cliffhanger. Ejemplos válidos:\n` +
      `- "¿Y si todo esto fuera solo el comienzo de una historia mucho más extraña?"\n` +
      `- "Pero lo que viene después nadie lo esperaba…"\n` +
      `- "La pregunta que queda es: ¿quién tenía realmente la razón?"\n` +
      `PROHIBIDO despedidas genéricas ("gracias por ver"). Reescribe SOLO la última escena si el resto está bien.\n`;
    return correction;
  }

  correction += 'Corrige el guion según la validación anterior antes de responder.\n';
  return correction;
}
