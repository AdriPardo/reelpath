import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getStoragePath } from '@autotube/config';

const PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MEM_MAX = 64;

type MemEntry = { at: number; buf: Buffer; contentType: string };

const memory = new Map<string, MemEntry>();

export function ttsPreviewCacheKey(params: {
  provider: string;
  voiceId: string;
  text: string;
  language: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      [
        params.provider.trim().toLowerCase(),
        params.voiceId.trim(),
        params.language.trim().toLowerCase(),
        params.text.trim(),
      ].join('|'),
    )
    .digest('hex');
}

function cacheFile(key: string): string {
  return getStoragePath('cache', 'tts-preview', `${key}.mp3`);
}

function touchMem(key: string, buf: Buffer, contentType: string) {
  memory.set(key, { at: Date.now(), buf, contentType });
  if (memory.size <= MEM_MAX) return;
  const oldest = [...memory.entries()].sort((a, b) => a[1].at - b[1].at)[0];
  if (oldest) memory.delete(oldest[0]);
}

export async function readTtsPreviewCache(
  key: string,
): Promise<{ buf: Buffer; contentType: string; hit: 'memory' | 'disk' } | null> {
  const mem = memory.get(key);
  if (mem && Date.now() - mem.at < PREVIEW_TTL_MS) {
    mem.at = Date.now();
    return { buf: mem.buf, contentType: mem.contentType, hit: 'memory' };
  }

  const filePath = cacheFile(key);
  try {
    const st = await fs.stat(filePath);
    if (Date.now() - st.mtimeMs > PREVIEW_TTL_MS || st.size === 0) return null;
    const buf = await fs.readFile(filePath);
    if (!buf.length) return null;
    touchMem(key, buf, 'audio/mpeg');
    return { buf, contentType: 'audio/mpeg', hit: 'disk' };
  } catch {
    return null;
  }
}

export async function writeTtsPreviewCache(key: string, buf: Buffer): Promise<void> {
  if (!buf.length) return;
  touchMem(key, buf, 'audio/mpeg');
  const filePath = cacheFile(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, buf);
  await fs.rename(tmp, filePath);
}
