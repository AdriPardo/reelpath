import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath } from '@autotube/config';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Purge stale stock search cache JSON under storage/cache/stock-search.
 */
export async function cleanupStockSearchCache(options?: {
  maxAgeMs?: number;
}): Promise<{ removed: number; bytes: number; dir: string }> {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const dir = getStoragePath('cache', 'stock-search');
  let removed = 0;
  let bytes = 0;
  const now = Date.now();

  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { removed: 0, bytes: 0, dir };
  }

  for (const name of entries) {
    if (!name.endsWith('.json') || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    try {
      const st = await fs.stat(full);
      if (!st.isFile()) continue;
      const age = now - st.mtimeMs;
      if (age <= maxAgeMs) continue;
      bytes += st.size;
      await fs.unlink(full);
      removed += 1;
    } catch {
      // fail-soft
    }
  }

  return { removed, bytes, dir };
}
