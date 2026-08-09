/**
 * Build short English stock-footage search queries (MoneyPrinterTurbo-inspired).
 * Stock APIs (Pexels/Pixabay/Coverr) rank English 1–3 word queries best.
 */

const STOPWORDS = new Set(
  [
    'a',
    'an',
    'the',
    'and',
    'or',
    'of',
    'to',
    'in',
    'on',
    'at',
    'for',
    'with',
    'from',
    'by',
    'as',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'into',
    'over',
    'under',
    'about',
    'above',
    'below',
    'between',
    'through',
    'during',
    'before',
    'after',
    'above',
    'very',
    'just',
    'also',
    'more',
    'most',
    'some',
    'such',
    'than',
    'too',
    'can',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'de',
    'la',
    'el',
    'los',
    'las',
    'un',
    'una',
    'unos',
    'unas',
    'y',
    'o',
    'en',
    'del',
    'al',
    'con',
    'por',
    'para',
    'que',
    'se',
    'su',
    'sus',
    'es',
    'son',
    'una',
    'como',
    'más',
    'muy',
    'close',
    'up',
    'shot',
    'view',
    'scene',
    'image',
    'photo',
    'cinematic',
    'dramatic',
    'beautiful',
    'showing',
    'shows',
    'featuring',
  ].map((w) => w.toLowerCase()),
);

/**
 * Prefer explicit `stockQuery`, else derive a compact English-ish query from
 * visual prompt / narration (max 3 content words).
 */
export function buildStockSearchQuery(params: {
  stockQuery?: string | null;
  visualPrompt?: string | null;
  narration?: string | null;
  fallback?: string;
}): string {
  const explicit = params.stockQuery?.trim();
  if (explicit) {
    return clampQueryWords(explicit, 4);
  }

  const base = (params.visualPrompt?.trim() || params.narration?.trim() || '').trim();
  if (!base) return params.fallback ?? 'documentary';

  const tokens = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/gi, ' ')
    .split(/[\s/_-]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));

  const unique: string[] = [];
  for (const token of tokens) {
    if (!unique.includes(token)) unique.push(token);
    if (unique.length >= 3) break;
  }

  if (unique.length === 0) {
    return clampQueryWords(base, 3) || (params.fallback ?? 'documentary');
  }

  return unique.join(' ');
}

function clampQueryWords(text: string, maxWords: number): string {
  return text
    .replace(/[^\w\s-]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ')
    .trim();
}
