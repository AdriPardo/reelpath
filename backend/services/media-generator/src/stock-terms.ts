import { getLlmClient, isLlmMockMode } from '@autotube/llm';
import { buildStockSearchQuery } from '@autotube/shared';
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
      `# Role: Video Search Terms Generator

## Goals
Generate ${amount} chronological stock-video search terms that follow the order of topics in the video script.

## Constraints
1. Return JSON object: { "terms": string[] } with exactly ${amount} strings.
2. Each term: 1-3 English words only.
3. Keep terms in the same order as the scenes listed.
4. Terms must be useful for Pexels/Pixabay/Coverr search.

## Context
### Subject
${opts?.subject ?? 'general'}

### Scenes
${scriptBlock}
`,
      'Responde SOLO JSON válido con clave terms (array de strings EN).',
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

  return map;
}
