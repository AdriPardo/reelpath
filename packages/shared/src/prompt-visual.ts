import type { MotionPreset, VisualSourceMode } from './types.js';
import { isHistoryNiche } from './retention.js';

const GENERIC_VISUAL_PATTERN =
  /^(cinematic|dramatic|historical|16:9|9:16|no text|photorealistic)/i;

const BANNED_STYLE_ONLY =
  /^(cinematic,?\s*dramatic lighting,?\s*(historical)?[,.\s]*)$/i;

/** Detecta visualPrompt demasiado genérico o corto para imagen IA. */
export function isGenericVisualPrompt(visualPrompt: string): boolean {
  const t = visualPrompt.trim();
  if (t.length < 35) return true;
  if (BANNED_STYLE_ONLY.test(t)) return true;
  if (/cinematic,?\s*dramatic lighting,?\s*historical/i.test(t) && t.split(/\s+/).length < 12) {
    return true;
  }
  return GENERIC_VISUAL_PATTERN.test(t) && t.split(/\s+/).length < 10;
}

export type ImageStyleFamily =
  | 'historical_documentary'
  | 'corporate_investigative'
  | 'general_documentary';

/** Estilo visual según nicho del canal (no forzar siempre "histórico"). */
export function resolveImageStyleFamily(niche?: string | null): ImageStyleFamily {
  const n = (niche ?? '').trim();
  if (!n) return 'general_documentary';
  if (
    /fraude|corporativ|escándalo|empresa|negocio|startup|finanzas|wall street|ceo|sec\b/i.test(n)
  ) {
    return 'corporate_investigative';
  }
  if (isHistoryNiche(n)) return 'historical_documentary';
  return 'general_documentary';
}

function styleDirective(family: ImageStyleFamily, aspectLabel: string): string {
  switch (family) {
    case 'corporate_investigative':
      return (
        `Investigative corporate documentary still, ${aspectLabel}, ` +
        `natural office light or cool practicals, photorealistic, shallow depth of field, ` +
        `no text, no watermark, no logos, no readable UI`
      );
    case 'historical_documentary':
      return (
        `Cinematic historical documentary still, ${aspectLabel}, ` +
        `motivated practical light, photorealistic period atmosphere, ` +
        `no text, no watermark, no modern anachronisms`
      );
    default:
      return (
        `Cinematic documentary still, ${aspectLabel}, ` +
        `natural motivated lighting, photorealistic, ` +
        `no text, no watermark, no logos`
      );
  }
}

const NEGATIVE_TAIL =
  'Avoid: text overlays, captions, subtitles, watermarks, logos, UI screens, ' +
  'blurry faces, deformed hands, extra fingers, collage, split screen, low-res, cartoon, anime';

function aspectLabel(aspectRatio: '9:16' | '16:9'): string {
  return aspectRatio === '9:16' ? 'vertical 9:16 framing' : 'horizontal 16:9 framing';
}

/**
 * Prompt final para Flux / gpt-image.
 * Estructura: sujeto concreto → estilo nicho → framing → negativos.
 */
export function buildAiImagePrompt(params: {
  visualPrompt: string;
  narration: string;
  sceneIndex: number;
  aspectRatio: '9:16' | '16:9';
  niche?: string | null;
}): string {
  const style = styleDirective(resolveImageStyleFamily(params.niche), aspectLabel(params.aspectRatio));
  const vp = params.visualPrompt.trim();

  if (!isGenericVisualPrompt(vp)) {
    return `${vp}. ${style}. ${NEGATIVE_TAIL}`.slice(0, 2800);
  }

  const sceneHint = params.narration.trim().slice(0, 280);
  const family = resolveImageStyleFamily(params.niche);
  const subjectLead =
    family === 'corporate_investigative'
      ? `Investigative documentary scene ${params.sceneIndex + 1}`
      : family === 'historical_documentary'
        ? `Historical documentary scene ${params.sceneIndex + 1}`
        : `Documentary scene ${params.sceneIndex + 1}`;

  return `${subjectLead}: ${sceneHint}. ${style}. ${NEGATIVE_TAIL}`.slice(0, 2800);
}

/** Directivas de cámara para fal image→video según MotionPreset del render. */
export function motionPresetToCameraPrompt(preset: MotionPreset): string {
  switch (preset) {
    case 'push-in':
      return 'slow push-in dolly toward the main subject';
    case 'pull-out':
      return 'slow pull-out reveal of the wider environment';
    case 'pan-left':
      return 'gentle horizontal pan left across the scene';
    case 'pan-right':
      return 'gentle horizontal pan right across the scene';
    case 'drift-up':
      return 'subtle upward camera drift';
    case 'drift-down':
      return 'subtle downward camera drift';
    default:
      return 'slow cinematic camera drift';
  }
}

/**
 * Prompt de motion para Hailuo / fal i2v.
 * Usa el preset de movimiento del pipeline cuando está disponible.
 */
export function buildI2vMotionPrompt(params: {
  visualPrompt: string;
  narration: string;
  motionPreset?: MotionPreset;
}): string {
  const base = params.visualPrompt.trim() || params.narration.trim().slice(0, 200);
  const camera = params.motionPreset
    ? motionPresetToCameraPrompt(params.motionPreset)
    : 'slow cinematic camera drift, subtle natural motion';
  return (
    `${base}. ${camera}, documentary realism, photorealistic continuity, ` +
    `no text, no watermark, no talking heads, no sudden cuts, no morphing faces`
  ).slice(0, 1500);
}

/**
 * Reglas siempre-on para que el LLM genere visualPrompt correcto según modo.
 * Resuelve el conflicto stock keywords (3-6) vs IA cinematográfica (15-30).
 */
export function getVisualPromptGenerationRules(mode: VisualSourceMode): string {
  if (mode === 'stock') {
    return (
      `VISUALES (modo STOCK):\n` +
      `- visualPrompt = 3-6 palabras clave EN para buscar B-roll filmable ` +
      `(ej: "busy city street night", "hands signing contract").\n` +
      `- Añade stockQuery opcional: 1-3 palabras EN aún más cortas para Pexels.\n` +
      `- Describe acciones/lugares reales; evita personajes históricos concretos, texto en pantalla, imposibles.\n` +
      `- Keywords DISTINTAS por escena. PROHIBIDO: "cinematic", "dramatic lighting", estilo IA.`
    );
  }

  if (mode === 'mixed') {
    return (
      `VISUALES (modo MIXTO stock + IA):\n` +
      `- Escenas pares (0,2,4…): visualPrompt = 3-6 keywords EN de stock filmable; ` +
      `stockQuery 1-3 palabras EN.\n` +
      `- Escenas impares (1,3,5…): visualPrompt = 15-30 palabras EN para imagen IA — ` +
      `sujeto concreto + plano (close-up/wide/aerial) + luz + atmósfera. ` +
      `PROHIBIDO solo "cinematic, dramatic lighting".\n` +
      `- Cada escena única. Sin texto/UI/watermarks en la descripción.`
    );
  }

  return (
    `VISUALES (modo IA):\n` +
    `- visualPrompt ÚNICO en inglés, 15-30 palabras: sujeto concreto + tipo de plano + iluminación + atmósfera.\n` +
    `- Alterna planos (close-up, medium, wide, aerial, detail insert).\n` +
    `- PROHIBIDO genéricos: "cinematic, dramatic lighting, historical" sin sujeto.\n` +
    `- Sin texto en pantalla, logos, watermarks ni collages.`
  );
}

/** Hints stock (compat); delega en reglas unificadas. */
export function getAiVisualScriptHints(mode: VisualSourceMode): string {
  if (mode === 'stock') return '';
  if (mode === 'mixed') {
    return (
      `\n\n${getVisualPromptGenerationRules('mixed')}`
    );
  }
  return `\n\n${getVisualPromptGenerationRules('image')}`;
}
