import { getLlmClient, isLlmMockMode } from '@autotube/llm';
import { buildStockSearchQuery, rerankTermsBySubject } from '@autotube/shared';
import type { ScriptScene } from '@autotube/shared';

/**
 * Optional LLM pass: one English stock query per scene, chronological order.
 * Inspired by MoneyPrinterTurbo `generate_terms(match_script_order=True)`.
 * Fail-soft → heuristic buildStockSearchQuery.
 */
export async function resolveSceneStockQueries(
  scenes: ScriptScene[],
  opts?: { subject?: string },
): Promise<Map<number, string>> {
  const map = new Map<number, string>();

  for (const scene of scenes) {
    if (scene.stockQuery?.trim()) {
      map.set(scene.index, buildStockSearchQuery({ stockQuery: scene.stockQuery }));
    }
  }

  const missing = scenes.filter((s) => !map.has(s.index));
  if (missing.length === 0) return map;

  // Heuristic fill first (always available).
  for (const scene of missing) {
    map.set(
      scene.index,
      buildStockSearchQuery({
        visualPrompt: scene.visualPrompt,
        narration: scene.narration,
      }),
    );
  }

  if (isLlmMockMode()) return map;

  try {
    const llm = getLlmClient();
    const amount = missing.length;
    const scriptBlock = missing
      .map((s) => `Scene ${s.index}: ${s.narration}\nVisual: ${s.visualPrompt}`)
      .join('\n\n');

    const result = await llm.completeJson<{ terms?: string[] }>(
      `# Role: Stock B-roll Search Terms Generator

## Goals
Generate ${amount} chronological English search terms for Pexels/Pixabay/Coverr that match each scene topic in order.

## Constraints
1. Return JSON: { "terms": string[] } with EXACTLY ${amount} strings.
2. Each term: 1-3 concrete English nouns/verbs (filmable actions or places).
3. Prefer real-world B-roll: offices, hands, city streets, documents, nature — not abstract concepts.
4. Avoid style words: cinematic, dramatic, lighting, beautiful, historical.
5. Keep the same order as the listed scenes.
6. Prefer terms that would return usable vertical/horizontal stock clips.

## Context
### Subject
${opts?.subject ?? 'general'}

### Scenes
${scriptBlock}
`,
      'Reply ONLY valid JSON with key terms (array of English strings).',
      { maxTokens: 400 },
    );

    const terms = Array.isArray(result.terms) ? result.terms : [];
    if (terms.length === missing.length) {
      for (let i = 0; i < missing.length; i += 1) {
        const scene = missing[i]!;
        const term = typeof terms[i] === 'string' ? terms[i]!.trim() : '';
        if (term) {
          map.set(scene.index, buildStockSearchQuery({ stockQuery: term }));
        }
      }
      console.info(`[stock-terms] LLM terms OK count=${terms.length}`);
    } else {
      console.warn(
        `[stock-terms] LLM terms length mismatch got=${terms.length} expected=${amount}; keep heuristic`,
      );
    }
  } catch (err) {
    console.warn(
      '[stock-terms] LLM failed; keep heuristic:',
      err instanceof Error ? err.message : err,
    );
  }

  // Lexical subject relevance (TwelveLabs-style, free): keep scene order but
  // surface how on-topic each term is for logs / future pool downloads.
  if (opts?.subject?.trim()) {
    const ordered = scenes
      .map((s) => map.get(s.index))
      .filter((t): t is string => Boolean(t));
    const ranked = rerankTermsBySubject(opts.subject, ordered);
    if (ranked[0] && ranked[0] !== ordered[0]) {
      console.info(
        `[stock-terms] subject-relevance top="${ranked[0]}" (scene-order preserved)`,
      );
    }
  }

  return map;
}
