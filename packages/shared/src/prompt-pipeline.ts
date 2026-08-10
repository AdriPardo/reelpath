import type { ChannelConfig, VideoFormat, VisualSourceMode } from './types.js';
import { getVisualPromptGenerationRules } from './prompt-visual.js';
import {
  formatDurationRange,
  getMinScriptWords,
  getTargetDurationMaxSec,
  getTargetDurationMinSec,
} from './duration.js';

/**
 * Capas de ingeniería de prompts SIEMPRE-ON para todo el pipeline de vídeo.
 * No dependen de re-seed DB: se inyectan en cada llamada LLM / image / i2v.
 */

/** Narración oral lista para TTS (guion largo y Shorts). */
export function getNarrationQualityRules(language: string, format: VideoFormat): string {
  const es = language === 'es' || language.startsWith('es-');
  if (!es) {
    return (
      `NARRATION QUALITY:\n` +
      `- Spoken documentary voice: clear sentences, commas for pauses.\n` +
      `- Concrete facts: names, dates, numbers, documented quotes.\n` +
      `- No listicles, no "today we'll talk about", no filler.\n` +
      (format === 'long'
        ? `- Body scenes: deep development, not Shorts-length lines.\n`
        : `- Short scenes: ≤12-14 words; punchy.\n`)
    );
  }

  return (
    `CALIDAD DE NARRACIÓN (locución TTS):\n` +
    `- Español oral profesional: frases claras, comas para pausas, cada escena termina en punto.\n` +
    `- Escribe cifras y fechas en forma hablable cuando puedas ("dos mil uno", "mil quinientos millones").\n` +
    `- Datos concretos: nombres, fechas, cifras, citas documentadas. Cero relleno.\n` +
    `- PROHIBIDO: "hoy vamos a hablar de", "bienvenidos", listas tipo "5 cosas", anglicismos innecesarios.\n` +
    (format === 'long'
      ? `- Documental largo: desarrolla mecanismo/contexto/consecuencias; NO estilo Shorts.\n`
      : `- Shorts: máx ~12-14 palabras/escena; pattern-interrupt en escena 1.\n`) +
    `- Una sola historia/curiosidad por vídeo — no mezclar temas.`
  );
}

/** Metadata YouTube embebida en generación de guion (title/description/tags). */
export function getScriptMetadataRules(format: VideoFormat): string {
  if (format === 'shorts') {
    return (
      `METADATA SHORT:\n` +
      `- title: específico, clickeable, ≤90 chars (dejar margen para #Shorts si hace falta).\n` +
      `- description: 1-2 frases + CTA suave; sin spam de hashtags.\n` +
      `- tags: 5-8 términos EN/ES relevantes (persona, lugar, tema), sin duplicados.`
    );
  }
  return (
    `METADATA YOUTUBE (SEO):\n` +
    `- title: 40-70 chars ideales (máx 100), sujeto + época/lugar + giro; sin clickbait vacío.\n` +
    `- description: 2-4 frases (máx ~400 chars) que resuman el misterio sin spoilers totales; ` +
    `primera línea = gancho searchable.\n` +
    `- tags: 6-8 términos concretos (persona, empresa, año, tema); mezcla ES/EN si ayuda SEO.\n` +
    `- PROHIBIDO title genérico ("Historia increíble", "No vas a creer").`
  );
}

/** Capa system para generación de ideas (complementa plantilla DB). */
export function getIdeaPipelineSystemHints(config: ChannelConfig): string {
  const format = config.videoFormat;
  const es = config.language === 'es' || config.language.startsWith('es-');
  const duration =
    format === 'long'
      ? formatDurationRange(getTargetDurationMinSec(config), getTargetDurationMaxSec(config))
      : '30-60s Short';
  const minWords = format === 'long' ? getMinScriptWords(config) : 0;

  const parts: string[] = [];
  if (es) {
    parts.push(
      format === 'long'
        ? `OBLIGATORIO: ideas en español. UNA sola historia/curiosidad con material para documental ${duration} (~${minWords}+ palabras de guion). Prohibido listas y temas superficiales.`
        : 'OBLIGATORIO: ideas íntegramente en español. Una sola curiosidad por idea — prohibido listas tipo "5 cosas".',
    );
  } else {
    parts.push(`Language: ${config.language}. Format: ${format} (${duration}). One curiosity per video.`);
  }

  parts.push(
    `CALIDAD IDEA:\n` +
      `- title específico (persona/lugar/año + giro), no genérico.\n` +
      `- hook que para el scroll en <2s: pregunta, cifra imposible o contradicción.\n` +
      `- angle = mecanismo o revelación que justifica ver hasta el final.\n` +
      `- Verificable: evita inventar hechos; prioriza casos/documentación pública cuando el nicho lo permita.\n` +
      `- Diferencia clara entre ideas de la misma tanda (ángulos distintos).`,
  );

  return parts.join('\n\n');
}

/** Capa user/system para outline chunked. */
export function getOutlinePipelineHints(config: ChannelConfig): string {
  return (
    `CALIDAD OUTLINE:\n` +
    `- Cada summary debe nombrar hechos: quién, cuándo, qué mecanismo, qué impacto.\n` +
    `- transitionToNext = puente emocional/narrativo (no "luego continúa").\n` +
    `- hookA/hookB deben poder decirse en ≤${config.retentionMode ? 15 : 20} palabras en voz alta.\n` +
    `- hookVisualPrompt alineado al modo visual del canal.\n` +
    getNarrationQualityRules(config.language, 'long')
  );
}

/** Capa para bloques de guion (chunk / monolithic body). */
export function getScriptBodyPipelineHints(
  config: ChannelConfig,
  visualMode: VisualSourceMode,
): string {
  return (
    `${getNarrationQualityRules(config.language, config.videoFormat)}\n\n` +
    `${getScriptMetadataRules(config.videoFormat)}\n\n` +
    `${getVisualPromptGenerationRules(visualMode)}`
  );
}

/** Teaser Short → vídeo largo. */
export function getTeaserPipelineHints(config: ChannelConfig, visualMode: VisualSourceMode): string {
  return (
    `CALIDAD TEASER SHORT:\n` +
    `- 3-4 escenas, 30-45s, máx ~12 palabras/escena.\n` +
    `- Escena 1: pattern-interrupt (<3s). Escenas medias: UN solo dato. Final: CTA al vídeo completo.\n` +
    `- NO resumas el documental escena a escena.\n` +
    `- title Short distinto del largo; description breve + #Shorts si encaja.\n\n` +
    getNarrationQualityRules(config.language, 'shorts') +
    `\n\n` +
    getVisualPromptGenerationRules(visualMode)
  );
}

/** Escenas de padding / expansión. */
export function getAssembleScenePipelineHints(
  config: ChannelConfig,
  visualMode: VisualSourceMode,
): string {
  return (
    `${getNarrationQualityRules(config.language, 'long')}\n` +
    `- Continúa el hilo desde la escena previa; no repitas el gancho.\n` +
    `- Incluye al menos un dato nuevo (nombre, fecha, cifra o consecuencia).\n` +
    getVisualPromptGenerationRules(visualMode)
  );
}

/** Cierre de retención. */
export function getRetentionClosingPipelineHints(format: VideoFormat): string {
  if (format === 'shorts') {
    return (
      `CIERRE SHORT: cliffhanger, pregunta abierta o teaser al siguiente vídeo. ` +
      `PROHIBIDO "gracias por ver" / "nos vemos".`
    );
  }
  return (
    `CIERRE DOCUMENTAL: pregunta retórica, reflexión con gancho o teaser suave. ` +
    `PROHIBIDO despedida larga o cliffhanger forzado estilo Shorts.`
  );
}

/** System hint EN/ES más fuerte para writers genéricos. */
export function getDocumentaryWriterSystem(language: string, role: string): string {
  if (language === 'es' || language.startsWith('es-')) {
    return (
      `${role} en español oral para locución profesional. ` +
      `Estilo documental investigativo (preciso, concreto, sin clickbait vacío). ` +
      `Responde SOLO JSON válido.`
    );
  }
  return `${role}. Spoken documentary style. Valid JSON only.`;
}
