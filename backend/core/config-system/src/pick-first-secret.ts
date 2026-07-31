/** Atlas envFrom / .env first; PlatformSecret DB fallback; leftover org BYOK last. */
export function pickFirstSecret(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
