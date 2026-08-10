import { getLlmClient, isLlmMockMode } from '@autotube/llm';
import {
  buildThumbnailCopyPrompt,
  deriveThumbnailOverlayText,
  type VideoFormat,
} from '@autotube/shared';

/**
 * Resuelve texto corto de overlay para miniatura (CTR).
 * LLM primero; fallback heurístico desde hook/título.
 */
export async function resolveThumbnailOverlayText(params: {
  title: string;
  hook?: string | null;
  angle?: string | null;
  niche?: string | null;
  format?: VideoFormat;
  language?: string;
  maxChars?: number;
}): Promise<{ overlayText: string; source: 'llm' | 'fallback' }> {
  const maxChars = params.maxChars ?? (params.format === 'shorts' ? 28 : 42);
  const fallback = deriveThumbnailOverlayText({
    title: params.title,
    hook: params.hook,
    maxChars,
  });

  if (isLlmMockMode()) {
    return { overlayText: fallback, source: 'fallback' };
  }

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
    const raw = await llm.completeJson<{ overlayText?: string; altOverlayText?: string }>(
      user,
      system,
      { maxTokens: 200 },
    );
    const primary = String(raw.overlayText ?? '').trim();
    const alt = String(raw.altOverlayText ?? '').trim();
    const pick =
      (primary && primary.length <= maxChars + 4 ? primary : '') ||
      (alt && alt.length <= maxChars + 4 ? alt : '') ||
      '';
    if (pick) {
      const cleaned = pick.replace(/\s+/g, ' ').trim().toUpperCase();
      if (cleaned.length >= 2) {
        return {
          overlayText: cleaned.length > maxChars ? cleaned.slice(0, maxChars - 1) + '…' : cleaned,
          source: 'llm',
        };
      }
    }
  } catch (err) {
    console.warn(
      '[thumbnail-copy] LLM falló; fallback heurístico:',
      err instanceof Error ? err.message : err,
    );
  }

  return { overlayText: fallback, source: 'fallback' };
}
