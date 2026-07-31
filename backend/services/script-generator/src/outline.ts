import { getMinScenes, getMaxScenes } from '@autotube/config';
import { getLlmClient } from '@autotube/llm';
import type { ChannelConfig } from '@autotube/shared';
import {
  buildLongDurationHint,
  buildOutlineSceneCountHint,
  clampYouTubeTitle,
  exampleOutlineSectionCounts,
  formatDurationRange,
  getMinScriptWords,
  getTargetDurationMinSec,
  getTargetDurationMaxSec,
  getTargetScriptWords,
  LONG_HOOK_MAX_WORDS,
  youtubeLongTitleMaxForShortParts,
  YOUTUBE_TITLE_MAX_CHARS,
} from '@autotube/shared';
import type { ScriptOutline, ScriptOutlineSection } from './types.js';
import { normalizeOutline, fixOutlineProgrammatic } from './normalize-outline.js';
import { validateOutline } from './validate.js';
import { sceneOptions } from './utils.js';

const MAX_OUTLINE_RETRIES = 1;
const MAX_OUTLINE_RETRIES_AFTER_NORMALIZE = 2;

function outlineSystemHint(language: string, config: ChannelConfig): string {
  const sceneOpts = sceneOptions(config);
  const minScenes = getMinScenes('long', sceneOpts);
  const maxScenes = getMaxScenes('long', sceneOpts);
  const targetScenes = Math.min(16, maxScenes);
  const range = formatDurationRange(
    getTargetDurationMinSec(config),
    getTargetDurationMaxSec(config),
  );
  const retentionNote =
    config.retentionMode
      ? ' Última sección: planifica cierre con pregunta abierta, teaser o cliffhanger suave (documental largo).'
      : '';

  if (language === 'es' || language.startsWith('es-')) {
    return (
      'Eres un guionista de documentales investigativos en español (estilo El Fraude Silencioso / divulgación histórica). ' +
      'Responde SOLO JSON válido. ' +
      `Planifica un documental de ${range} con ${minScenes}-${maxScenes} escenas (objetivo ${targetScenes}). ` +
      `NO escribas el guion completo — solo la estructura (outline). ` +
      `hookA/hookB: pattern-interrupt brutal, escena 1 ≤${LONG_HOOK_MAX_WORDS} palabras. PROHIBIDO "hoy vamos a hablar de". ` +
      'Arco: gancho → contexto → mecanismo del enigma → consecuencias → lección → cierre con gancho. ' +
      '3-4 secciones con sceneCount, summary (datos concretos, nombres, cifras) y transitionToNext.' +
      retentionNote
    );
  }
  return 'Documentary script outline planner. Valid JSON only.';
}

function buildOutlinePrompt(
  idea: { title: string; hook: string; angle: string },
  config: ChannelConfig,
  channelContext: string,
): string {
  const sceneOpts = sceneOptions(config);
  const minScenes = getMinScenes('long', sceneOpts);
  const maxScenes = getMaxScenes('long', sceneOpts);
  const targetScenes = Math.min(16, maxScenes);
  const exampleCounts = exampleOutlineSectionCounts(targetScenes);
  const minWords = getMinScriptWords(config);
  const targetWords = getTargetScriptWords(config);
  const exampleSections = exampleCounts
    .map((count, i) => {
      const isLast = i === exampleCounts.length - 1;
      const titles = ['Contexto', 'Desarrollo', 'Impacto', 'Cierre'];
      const title = titles[i] ?? `Sección ${i + 1}`;
      const lastSummary =
        config.retentionMode
          ? 'Reflexión final + pregunta al espectador o cliffhanger (ej: "¿Y si todo esto fuera solo el comienzo?")'
          : '...';
      return (
        `    { "title": "${title}", "sceneCount": ${count}, "summary": "${isLast && config.retentionMode ? lastSummary : '...'}",` +
        (isLast ? ' "transitionToNext": null }' : ' "transitionToNext": "..." }')
      );
    })
    .join(',\n');

  const retentionOutlineRules = config.retentionMode
    ? `- ESCENA FINAL (última sección): debe planificarse con cierre de retención — pregunta abierta, teaser de continuación o cliffhanger. OBLIGATORIO.\n` +
      `  Ejemplo válido en summary de última sección: "Cierre reflexivo + ¿Y si la respuesta estuviera en un detalle que todos ignoraron?"\n`
    : '';

  const titleMax =
    config.publishYoutubeShorts === true
      ? youtubeLongTitleMaxForShortParts()
      : YOUTUBE_TITLE_MAX_CHARS;

  return (
    `Planifica la ESTRUCTURA (outline) de un guion documental largo. NO generes narraciones completas todavía.\n\n` +
    `Tema: ${idea.title}\n` +
    `Gancho inicial sugerido: ${idea.hook}\n` +
    `Ángulo / giro: ${idea.angle}\n\n` +
    `${buildLongDurationHint(config)}\n\n` +
    `PALABRAS OBJETIVO: planifica ~${targetWords} palabras totales de narración (mínimo absoluto ${minWords} para ${formatDurationRange(getTargetDurationMinSec(config), getTargetDurationMaxSec(config))}). ` +
    `Reparte el peso narrativo entre secciones — bloques con sceneCount alto deben cubrir más historia.\n\n` +
    `${buildOutlineSceneCountHint({ minScenes, maxScenes, targetScenes })}\n\n` +
    `REGLAS DEL OUTLINE:\n` +
    `- totalScenes = 1 (gancho) + suma de sceneCount de todas las secciones\n` +
    `- Objetivo: ${targetScenes} escenas totales (válido 12-20 si supera 8 min), distribuidas en 3-4 secciones\n` +
    `- Arco narrativo investigativo: gancho brutal → contexto (época, lugar, protagonistas) → mecanismo del enigma/engaño → consecuencias → lección → cierre memorable\n` +
    `- hookA: pregunta directa que contradiga creencias (≤${LONG_HOOK_MAX_WORDS} palabras). Ej: "¿Y si el imperio cayó por un error de traducción?"\n` +
    `- hookB: afirmación impactante con dato concreto (≤${LONG_HOOK_MAX_WORDS} palabras). Ej: "Nadie sabe que este tratado se firmó tres días después de la muerte del rey."\n` +
    `- hookVisualPrompt: descripción visual concreta en inglés para escena 1 (NO genérico)\n` +
    `- title del vídeo: frase completa ≤${titleMax} caracteres (límite YouTube; no cortes a medias)\n` +
    `- Cada summary debe incluir nombres, fechas o cifras verificables — no generalidades\n` +
    `- Cada sección: title, sceneCount (≥2), summary (qué cubre el bloque), transitionToNext (frase puente; omitir en última sección)\n` +
    `- transitionToNext debe conectar emocionalmente con el summary de la siguiente sección\n` +
    retentionOutlineRules +
    channelContext +
    `\n\nResponde JSON:\n` +
    `{\n` +
    `  "title": "...",\n` +
    `  "description": "...",\n` +
    `  "tags": ["..."],\n` +
    `  "hookA": "...",\n` +
    `  "hookB": "...",\n` +
    `  "hookVisualPrompt": "...",\n` +
    `  "totalScenes": ${targetScenes},\n` +
    `  "sections": [\n` +
    `${exampleSections}\n` +
    `  ]\n` +
    `}`
  );
}

function parseOutline(raw: Record<string, unknown>): ScriptOutline {
  const sectionsRaw = raw.sections ?? raw.acts ?? raw.bloques;
  if (!Array.isArray(sectionsRaw)) {
    throw new Error('Outline sin array sections');
  }

  const sections: ScriptOutlineSection[] = sectionsRaw.map((s: Record<string, unknown>) => ({
    title: String(s.title ?? s.name ?? 'Sección'),
    sceneCount: Number(s.sceneCount ?? s.scenes ?? s.scene_count ?? 0),
    summary: String(s.summary ?? s.descripcion ?? ''),
    transitionToNext: s.transitionToNext != null ? String(s.transitionToNext) : undefined,
  }));

  return {
    title: clampYouTubeTitle(String(raw.title ?? 'Sin título')),
    description: String(raw.description ?? ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    hookA: String(raw.hookA ?? raw.hook_a ?? raw.hook ?? ''),
    hookB: String(raw.hookB ?? raw.hook_b ?? raw.hookA ?? raw.hook ?? ''),
    hookVisualPrompt: String(raw.hookVisualPrompt ?? raw.hook_visual ?? ''),
    totalScenes: Number(raw.totalScenes ?? raw.total_scenes ?? 0),
    sections,
  };
}

export async function generateOutline(params: {
  idea: { title: string; hook: string; angle: string };
  config: ChannelConfig;
  channelContext: string;
}): Promise<ScriptOutline> {
  const { idea, config, channelContext } = params;
  const llm = getLlmClient();
  const prompt = buildOutlinePrompt(idea, config, channelContext);
  const system = outlineSystemHint(config.language, config);
  let lastError: string | null = null;
  let maxAttempts = MAX_OUTLINE_RETRIES;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let raw: unknown;
    try {
      raw = await llm.completeJson<unknown>(
        attempt === 1 ? prompt : `${prompt}\n\n⚠️ CORRECCIÓN (intento ${attempt - 1} rechazado): ${lastError}`,
        system,
        { maxTokens: 2000 },
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[script] Outline LLM attempt ${attempt}/${MAX_OUTLINE_RETRIES} failed: ${lastError}`);
      continue;
    }

    let outline: ScriptOutline;
    try {
      if (typeof raw !== 'object' || raw === null) throw new Error('Respuesta no es objeto');
      outline = parseOutline(raw as Record<string, unknown>);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[script] Outline parse attempt ${attempt}/${MAX_OUTLINE_RETRIES} failed: ${lastError}`);
      continue;
    }

    const sceneOpts = sceneOptions(config);
    const minScenes = getMinScenes('long', sceneOpts);
    const maxScenes = getMaxScenes('long', sceneOpts);
    const normalized = normalizeOutline(outline, minScenes, maxScenes);
    outline = fixOutlineProgrammatic(normalized.outline);
    if (normalized.adjusted) {
      console.info(`[script] Outline normalizado: ${normalized.notes.join('; ')}`);
      maxAttempts = Math.min(maxAttempts, MAX_OUTLINE_RETRIES_AFTER_NORMALIZE);
    }

    const validationError = validateOutline(outline, config);
    if (!validationError) {
      console.info(
        `[script] Outline OK: ${outline.sections.length} sections, ${outline.totalScenes} scenes`,
      );
      return outline;
    }

    lastError = validationError;
    console.warn(`[script] Outline attempt ${attempt}/${MAX_OUTLINE_RETRIES} rejected: ${validationError}`);
  }

  throw new Error(`Outline inválido tras ${MAX_OUTLINE_RETRIES} intentos: ${lastError ?? 'unknown'}`);
}
