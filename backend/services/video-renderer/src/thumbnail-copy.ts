import { getLlmClient, isLlmMockMode } from '@autotube/llm';
import {
  buildThumbnailCopyPrompt,
  deriveThumbnailOverlayText,
  pickThumbnailHighlightWord,
  type VideoFormat,
} from '@autotube/shared';

export type ThumbnailOverlayResult = {
  overlayText: string;
  highlightWord: string;
  source: 'llm' | 'fallback';
};

/**
 * Resuelve texto corto de overlay + palabra highlight (amarillo).
 * KPI: legible en ~0.3s a tamaño móvil.
 */
export async function resolveThumbnailOverlayText(params: {
  title: string;
  hook?: string | null;
  angle?: string | null;
  niche?: string | null;
  format?: VideoFormat;
  language?: string;
  maxChars?: number;
}): Promise<ThumbnailOverlayResult> {
  const maxChars = params.maxChars ?? (params.format === 'shorts' ? 22 : 28);
  const fallbackText = deriveThumbnailOverlayText({
    title: params.title,
    hook: params.hook,
    maxChars,
  });
  const fallback: ThumbnailOverlayResult = {
    overlayText: fallbackText,
    highlightWord: pickThumbnailHighlightWord(fallbackText),
    source: 'fallback',
  };

  if (isLlmMockMode()) return fallback;

  try {
    const llm = getLlmClient();
    const { system, user } = buildThumbnailCopyPrompt({
      title: params.title,
      hook: params.hook ?? undefined,
      angle: params.angle ?? undefined,
      niche: params.niche ?? undefined,
      format: params.format ?? 'long',
      language: params.language ?? 'es',
    });
    const raw = await llm.completeJson<{
      overlayText?: string;
      altOverlayText?: string;
      highlightWord?: string;
    }>(user, system, { maxTokens: 220 });

    const primary = String(raw.overlayText ?? '').trim();
    const alt = String(raw.altOverlayText ?? '').trim();
    const pick =
      (primary && primary.length <= maxChars + 6 ? primary : '') ||
      (alt && alt.length <= maxChars + 6 ? alt : '') ||
      '';

    if (pick) {
      let cleaned = pick.replace(/\s+/g, ' ').trim().toUpperCase();
      if (cleaned.length > maxChars) {
        cleaned = cleaned.slice(0, maxChars - 1) + '…';
      }
      if (cleaned.length >= 2) {
        const hlRaw = String(raw.highlightWord ?? '').trim().toUpperCase();
        const highlightWord =
          hlRaw && cleaned.includes(hlRaw) ? hlRaw : pickThumbnailHighlightWord(cleaned);
        return { overlayText: cleaned, highlightWord, source: 'llm' };
      }
    }
  } catch (err) {
    console.warn(
      '[thumbnail-copy] LLM falló; fallback heurístico:',
      err instanceof Error ? err.message : err,
    );
  }

  return fallback;
}
