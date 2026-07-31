/** YouTube Data API: snippet.title must be 1–100 characters (invalidTitle otherwise). */
export const YOUTUBE_TITLE_MAX_CHARS = 100;
export const YOUTUBE_SHORTS_TITLE_SUFFIX = ' #Shorts';

/** Sufijo típico « — Parte N/M» con N,M ≤ 9 (p. ej. 3/3). */
const PART_SUFFIX_RESERVE = ' — Parte 9/9'.length;

const PART_SUFFIX_RE = /^(.*?)( — Parte \d+\/\d+)$/;

/** Chars left for the base title when ` #Shorts` will be appended at publish. */
export function youtubeShortsTitleBudget(): number {
  return YOUTUBE_TITLE_MAX_CHARS - YOUTUBE_SHORTS_TITLE_SUFFIX.length;
}

/**
 * Máx. del título del vídeo largo para que «{título} — Parte N/M #Shorts» quepa entero
 * (sin truncar a mitad de frase). Con Shorts activos, generar ≤ este valor.
 */
export function youtubeLongTitleMaxForShortParts(): number {
  return youtubeShortsTitleBudget() - PART_SUFFIX_RESERVE;
}

export function youtubePartSuffix(partIndex1Based: number, partCount: number): string {
  return ` — Parte ${partIndex1Based}/${partCount}`;
}

function truncateAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(max * 0.6)) return cut.slice(0, lastSpace).trimEnd();
  return cut.trimEnd();
}

/** Trunca el título a ≤ max chars; vacío → fallback. Prefiere conservar « — Parte N/M». */
export function clampYouTubeTitle(
  title: string,
  fallback = 'Untitled',
  max = YOUTUBE_TITLE_MAX_CHARS,
): string {
  const trimmed = title.trim() || fallback;
  if (trimmed.length <= max) return trimmed;
  const partMatch = trimmed.match(PART_SUFFIX_RE);
  if (partMatch) {
    const [, head, part] = partMatch;
    const maxHead = max - part.length;
    if (maxHead >= 8) {
      return `${truncateAtWord(head, maxHead)}${part}`;
    }
  }
  return truncateAtWord(trimmed, max);
}

/**
 * Título de un corte del largo ya dentro del límite de YouTube.
 * Por defecto reserva espacio para ` #Shorts` (lo añade el publisher si falta).
 * Si el título largo se generó ≤ youtubeLongTitleMaxForShortParts(), el resultado queda completo.
 */
export function formatYouTubePartTitle(
  baseTitle: string,
  partIndex1Based: number,
  partCount: number,
  options?: { reserveShortsTag?: boolean },
): string {
  const reserve = options?.reserveShortsTag !== false;
  const max = reserve ? youtubeShortsTitleBudget() : YOUTUBE_TITLE_MAX_CHARS;
  const part = youtubePartSuffix(partIndex1Based, partCount);
  const headBudget = Math.max(8, max - part.length);
  const head = clampYouTubeTitle(baseTitle, 'Short', headBudget);
  return clampYouTubeTitle(`${head}${part}`, 'Short', max);
}

/**
 * Título de Short listo para guardar/subir (≤100).
 * Con ensureShortsTag (default) garantiza `#Shorts` dentro del límite.
 */
export function formatYouTubeShortTitle(
  title: string,
  options?: { ensureShortsTag?: boolean },
): string {
  const ensure = options?.ensureShortsTag !== false;
  const raw = title.trim() || 'Short';
  if (!ensure) return fitYouTubeTitleBeforeShortsTag(raw);
  if (/\b#Shorts\b/i.test(raw)) return clampYouTubeTitle(raw, 'Short');
  return `${fitYouTubeTitleBeforeShortsTag(raw)}${YOUTUBE_SHORTS_TITLE_SUFFIX}`;
}

/** Título sin `#Shorts`, dejando hueco para el sufijo que añade el publisher. */
export function fitYouTubeTitleBeforeShortsTag(title: string, fallback = 'Short'): string {
  return clampYouTubeTitle(title, fallback, youtubeShortsTitleBudget());
}
