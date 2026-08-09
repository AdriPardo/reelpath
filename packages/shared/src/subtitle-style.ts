/**
 * Subtitle readability checks (MPT-inspired).
 */

/** Relative luminance 0–1 from #RRGGBB. */
export function hexLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(fgHex: string, bgHex: string): number | null {
  const a = hexLuminance(fgHex);
  const b = hexLuminance(bgHex);
  if (a == null || b == null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function subtitleColorsAreIndistinguishable(
  fgHex: string,
  bgHex: string,
  minRatio = 3,
): boolean {
  const ratio = contrastRatio(fgHex, bgHex);
  if (ratio == null) return false;
  return ratio < minRatio;
}

/** Basic Latin + Spanish sample — Arial covers these; warn if exotic scripts dominate. */
export function subtitleTextNeedsExtendedFont(text: string): boolean {
  // CJK / Arabic / Cyrillic / Devanagari → recommend extended font pack
  return /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(
    text,
  );
}

export function warnSubtitleStyle(params: {
  fgHex?: string;
  bgHex?: string;
  sampleText?: string;
}): string[] {
  const warnings: string[] = [];
  if (
    params.fgHex &&
    params.bgHex &&
    subtitleColorsAreIndistinguishable(params.fgHex, params.bgHex)
  ) {
    warnings.push(
      `subtitle contrast low (${params.fgHex} on ${params.bgHex}); raise outline/background`,
    );
  }
  if (params.sampleText && subtitleTextNeedsExtendedFont(params.sampleText)) {
    warnings.push('subtitle text uses non-Latin scripts; Arial may miss glyphs');
  }
  return warnings;
}
