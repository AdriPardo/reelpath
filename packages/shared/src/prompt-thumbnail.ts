/**
 * Ingeniería de prompts para miniaturas YouTube.
 * Principio: la miniatura es el PRIMER producto de atención (CTR), no un afterthought.
 */

import type { ChannelConfig, VideoFormat } from './types.js';
import { resolveImageStyleFamily } from './prompt-visual.js';

/** Reglas CTR: legible a ~160–320px de ancho (fila móvil YouTube). */
export function getThumbnailCopyRules(format: VideoFormat = 'long'): string {
  const budget =
    format === 'shorts'
      ? '1-3 palabras (máx 22 chars). Vertical.'
      : '2-4 palabras (máx 28 chars). Horizontal móvil.';

  return (
    `TEXTO MINIATURA — PRIORIDAD #1 DEL VÍDEO (CTR):\n` +
    `- ${budget}\n` +
    `- Fórmula ganadora: CIFRA+SUJETO o ADJETIVO+SUJETO. Ej: "2.400M MENTIRA", "EMPERADOR LOCO", "FRAUDE TOTAL".\n` +
    `- 1 sola idea. MAYÚSCULAS. Cero artículos (EL/LA/LOS) si sobran caracteres.\n` +
    `- highlightWord = la palabra que debe ir en AMARILLO (impacto): cifra, SECRETO, MENTIRA, FRAUDE, NUNCA…\n` +
    `- PROHIBIDO: título SEO, frases largas, hashtags, emojis, "mira esto", "capítulo 1".\n` +
    `- Test: si no se lee en 0.3s a tamaño uña de pulgar, FALLA.`
  );
}

/** Prompt system/user para generar overlay + palabra highlight. */
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
    ? `Eres el mejor director de miniaturas YouTube de habla hispana. Tu único KPI es CTR. ${getThumbnailCopyRules(format)} Responde SOLO JSON.`
    : `You are an elite YouTube thumbnail director. Only KPI is CTR. ${getThumbnailCopyRules(format)} Valid JSON only.`;

  const user =
    `Diseña el texto de la miniatura (lo primero que ve el espectador).\n` +
    `Título vídeo: ${params.title}\n` +
    (params.hook ? `Gancho: ${params.hook}\n` : '') +
    (params.angle ? `Ángulo: ${params.angle}\n` : '') +
    (params.niche ? `Nicho: ${params.niche}\n` : '') +
    `\n${getThumbnailCopyRules(format)}\n\n` +
    `JSON: {\n` +
    `  "overlayText": "2-4 palabras MAYÚSCULAS",\n` +
    `  "highlightWord": "palabra a destacar en amarillo (debe aparecer en overlayText)",\n` +
    `  "altOverlayText": "alternativa igual de corta"\n` +
    `}`;

  return { system, user };
}

/**
 * Fallback sin LLM: acorta título/hook a copy de miniatura legible.
 * Prioriza cifra + primeras palabras fuertes.
 */
export function deriveThumbnailOverlayText(params: {
  title: string;
  hook?: string | null;
  maxChars?: number;
}): string {
  const maxChars = params.maxChars ?? 28;
  const hook = params.hook?.trim();
  if (hook) {
    const cleaned = hook
      .replace(/^¿/, '')
      .replace(/[?!…]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const withNumber = preferNumberLead(cleaned, maxChars);
    if (withNumber) return withNumber.toUpperCase();
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

/** Elige highlightWord desde overlay (cifra o última palabra fuerte). */
export function pickThumbnailHighlightWord(overlayText: string): string {
  const words = overlayText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const withDigit = words.find((w) => /\d/.test(w));
  if (withDigit) return withDigit;
  const power = words.find((w) =>
    /^(SECRETO|MENTIRA|FRAUDE|NUNCA|OCULTO|PROHIBIDO|FALSO|IMPOSIBLE|ESCÁNDALO|TOTAL|LOCO|MUERTE)$/i.test(
      w,
    ),
  );
  if (power) return power;
  return words[words.length - 1]!;
}

function preferNumberLead(text: string, maxChars: number): string | null {
  const m = text.match(/(\d[\d.,]*\s*(?:m|millones|mil|%|años)?)/i);
  if (!m) return null;
  const num = m[1]!.replace(/\s+/g, '').toUpperCase().replace(/MILLONES/i, 'M');
  const rest = text
    .replace(m[0], '')
    .replace(/^(que|de|del|la|el|los|las|un|una)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');
  const combo = rest ? `${num} ${rest}` : num;
  return truncateThumbWords(combo, maxChars);
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

/**
 * Fondo IA: debe detener el scroll SOLO.
 * Cara/emoción u objeto impactante + mitad limpia para texto.
 */
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
      ? 'investigative thriller key-art, shocked executive face OR torn SEC document close-up, cold blue practicals, high saturation'
      : family === 'historical_documentary'
        ? 'epic historical key-art, intense face OR iconic artifact extreme close-up, Rembrandt lighting, high saturation'
        : 'viral documentary key-art, intense human emotion or shocking object close-up, high saturation contrast';

  const subjectHint =
    [params.hook, params.angle, params.title].filter(Boolean).join(' — ').slice(0, 200) ||
    params.title;

  const framing =
    aspect === '9:16'
      ? 'vertical 9:16 YouTube Shorts thumbnail, subject fills lower 60%, CLEAN dark upper band for huge text'
      : 'horizontal 16:9 YouTube thumbnail, subject packed on RIGHT 45%, LEFT 55% dark clean negative space for huge bold text';

  return (
    `VIRAL YouTube thumbnail BACKGROUND (scroll-stopper, NOT a random video frame): ${subjectHint}. ` +
    `${style}. ${framing}. ` +
    `Extreme contrast, punchy colors, shallow depth of field, single clear focal point, ` +
    `emotionally charged, designed to stop the thumb at 160px wide. ` +
    `STRICT: no text, no letters, no numbers burned in, no watermark, no logos, no UI, no collage, no split-screen, no subtitles`
  ).slice(0, 2800);
}

/** Hints para inyectar en generación de guion (la miniatura manda). */
export function getThumbnailPipelineHints(config: ChannelConfig): string {
  return (
    `\nMINIATURA = PRODUCTO #1 (antes que el guion largo):\n` +
    `- Diseña title/hook pensando en la miniatura primero.\n` +
    `- El hook DEBE aportar cifra, nombre propio o paradoja usable en 2-4 palabras de overlay.\n` +
    getThumbnailCopyRules(config.videoFormat)
  );
}
