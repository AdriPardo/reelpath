/**
 * Round-robin API key rotation (MoneyPrinterTurbo-inspired).
 * Accepts comma-separated keys or arrays. Process-local counters.
 */

const counters = new Map<string, number>();

export function parseSecretKeyList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function nextRotatedSecret(
  poolName: string,
  raw: string | string[] | null | undefined,
): string | undefined {
  const keys = Array.isArray(raw) ? raw.map((k) => k.trim()).filter(Boolean) : parseSecretKeyList(raw);
  if (keys.length === 0) return undefined;
  if (keys.length === 1) return keys[0];

  const prev = counters.get(poolName) ?? 0;
  const idx = prev % keys.length;
  counters.set(poolName, prev + 1);
  return keys[idx];
}

/** Test helper. */
export function resetSecretRotation(poolName?: string): void {
  if (poolName) counters.delete(poolName);
  else counters.clear();
}
