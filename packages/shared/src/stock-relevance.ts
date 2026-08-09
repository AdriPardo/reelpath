/**
 * Lexical stock relevance (MoneyPrinterTurbo TwelveLabs pattern, without paid API).
 * Reorders search terms and boosts candidates by token overlap with subject/query.
 */

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function tokenizeRelevanceText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\s,/|_\-.:;]+/)) {
    const t = normalizeToken(part);
    if (t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const t of a) if (setB.has(t)) inter += 1;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * Reorder search terms so the most on-topic ones come first (timeline budget).
 * Stable for ties.
 */
export function rerankTermsBySubject(subject: string, terms: string[]): string[] {
  const subjectTokens = tokenizeRelevanceText(subject);
  if (subjectTokens.length === 0 || terms.length <= 1) return [...terms];

  return terms
    .map((term, index) => ({
      term,
      index,
      score: jaccardSimilarity(subjectTokens, tokenizeRelevanceText(term)),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.term);
}

/** Multiply base resolution score by (1 + relevance). */
export function boostScoreByQueryRelevance(
  baseScore: number,
  query: string,
  candidateText?: string | null,
): number {
  if (!Number.isFinite(baseScore) || baseScore <= 0) return baseScore;
  const q = tokenizeRelevanceText(query);
  const c = tokenizeRelevanceText(candidateText ?? '');
  if (q.length === 0 || c.length === 0) return baseScore;
  const rel = jaccardSimilarity(q, c);
  return baseScore * (1 + rel);
}
