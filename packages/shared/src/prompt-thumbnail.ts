/**
 * Ingeniería de prompts para miniaturas YouTube (CTR).
 * Copy overlay corto + fondo IA de alto contraste.
 */

import type { ChannelConfig, VideoFormat } from './types.js';
import { resolveImageStyleFamily } from './prompt-visual.js';

/** Reglas para el LLM que escribe el texto de la miniatura. */
export function getThumbnailCopyRules(format: VideoFormat = 'long'): string {
  const lines =
    format === 'shorts'
      ? '1-4 palabras (máx 28 chars). Caber en vertical móvil.'
      : '2-5 palabras (máx 42 chars). Legible en móvil (fila de recomendaciones).';

  return (
    `TEXTO MINIATURA YOUTUBE (CTR crítico):\n` +
    `- ${lines}\n` +
    `- MAYÚSCULAS o Title Case; palabras de impacto (SECRETO, NUNCA, MENTIRA, FRAUDE, OCULTO…).\n` +
    `- Preferir: cifra + sujeto, o paradoja corta. Ej: "2.400M DESAPARECIDOS", "EL EMPERADOR LOCO".\n` +
    `- PROHIBIDO: título SEO completo, subtítulos largos, "mira este vídeo", hashtags, emojis.\n` +
    `- Debe funcionar SIN conocer el vídeo: solo la línea vende el click.`
  );
}

/** Prompt system/user para generar overlay text. */
export function buildThumbnailCopyPrompt(params: {
  title: string;
  hook?: string;
  angle?: string;
  niche?: string;
  format?: VideoFormat;
  language?: string;
}): { system: string; user: string } {
  const format = params.format ?? 'long';
  const lang = params.language ?? 'es';
  const es = lang === 'es' || lang.startsWith('es-');

  const system = es
    ? `Eres director creativo de miniaturas YouTube. ${getThumbnailCopyRules(format)} Responde SOLO JSON válido.`
    : `You are a YouTube thumbnail creative director. ${getThumbnailCopyRules(format)} Valid JSON only.`;

  const user =
    `Genera el texto de overlay para la miniatura.\n` +
    `Título vídeo: ${params.title}\n` +
    (params.hook ? `Gancho: ${params.hook}\n` : '') +
    (params.angle ? `Ángulo: ${params.angle}\n` : '') +
    (params.niche ? `Nicho: ${params.niche}\n` : '') +
    `\n${getThumbnailCopyRules(format)}\n\n` +
    `JSON: { "overlayText": "...", "altOverlayText": "..." }`;

  return { system, user };
}

/**
 * Fallback sin LLM: acorta título/hook a copy de miniatura legible.
 */
export function deriveThumbnailOverlayText(params: {
  title: string;
  hook?: string | null;
  maxChars?: number;
}): string {
  const maxChars = params.maxChars ?? 42;
  const hook = params.hook?.trim();
  if (hook) {
    const cleaned = hook
      .replace(/^¿/, '')
      .replace(/[?!…]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length > 0 && cleaned.length <= maxChars) {
      return cleaned.toUpperCase();
    }
    if (cleaned.length > maxChars) {
      return truncateThumbWords(cleaned, maxChars).toUpperCase();
    }
  }

  const title = params.title
    .replace(/\s*[—|-]\s*Parte\s+\d+.*$/i, '')
    .replace(/\s*#Shorts\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return truncateThumbWords(title, maxChars).toUpperCase();
}

function truncateThumbWords(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const words = text.split(/\s+/).filter(Boolean);
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > maxChars) break;
    out = next;
  }
  if (!out) return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
  return out.length < text.length && out.length <= maxChars - 1 ? `${out}…` : out;
}

/** Prompt de fondo IA dedicado a miniatura (alto contraste, espacio para texto). */
export function buildThumbnailBackgroundPrompt(params: {
  title: string;
  hook?: string;
  angle?: string;
  niche?: string | null;
  aspectRatio?: '16:9' | '9:16';
}): string {
  const aspect = params.aspectRatio ?? '16:9';
  const family = resolveImageStyleFamily(params.niche);
  const style =
    family === 'corporate_investigative'
      ? 'investigative thriller documentary still, cool practical light, glass offices or court documents'
      : family === 'historical_documentary'
        ? 'dramatic historical documentary still, golden-hour or torchlight, period atmosphere'
        : 'dramatic documentary still, cinematic contrast lighting';

  const subjectHint =
    [params.hook, params.angle, params.title].filter(Boolean).join(' — ').slice(0, 220) ||
    params.title;

  const framing =
    aspect === '9:16'
      ? 'vertical 9:16, subject in lower two-thirds, clean upper third for text'
      : 'horizontal 16:9, strong subject on the RIGHT third, clean LEFT third for bold text overlay';

  return (
    `YouTube thumbnail background (NOT a video frame): ${subjectHint}. ` +
    `${style}, ${framing}, extreme contrast, photorealistic, shallow depth of field, ` +
    `emotionally charged focal point, no text, no watermark, no logos, no UI, no collage, ` +
    `no subtitles, leave negative space for large title text`
  ).slice(0, 2800);
}

/** Hints para inyectar en generación de guion (metadata de miniatura). */
export function getThumbnailPipelineHints(config: ChannelConfig): string {
  return (
    `\nMINIATURA (planificar CTR):\n` +
    `- El title del vídeo debe poder reducirse a 2-5 palabras de impacto para overlay.\n` +
    `- El hook debe contener una cifra, nombre o paradoja usable en miniatura.\n` +
    getThumbnailCopyRules(config.videoFormat)
  );
}
