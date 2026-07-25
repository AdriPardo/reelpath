import { loadConfig } from '@autotube/config';
import { Redis } from 'ioredis';

let client: Redis | null = null;

function getRedis(): Redis {
  if (!client) {
    client = new Redis(loadConfig().REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch {
    // cache miss on error — no bloquear la petición
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    await redis.del(key);
  } catch {
    // ignore
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const redis = getRedis();
    if (redis.status !== 'ready') await redis.connect();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // ignore
  }
}
