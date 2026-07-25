import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './index.js';

export type StorageBackend = 'local' | 's3';

export function isS3Configured(): boolean {
  const cfg = loadConfig();
  return Boolean(cfg.S3_ENDPOINT && cfg.S3_BUCKET && cfg.S3_ACCESS_KEY && cfg.S3_SECRET_KEY);
}

export function getStorageBackend(): StorageBackend {
  return isS3Configured() ? 's3' : 'local';
}

/** Ruta absoluta local bajo STORAGE_PATH para una clave relativa (p. ej. uploads/org/file.mp4). */
export function resolveLocalStoragePath(relativeKey: string): string {
  const base = path.resolve(loadConfig().STORAGE_PATH);
  const abs = path.resolve(base, relativeKey);
  if (!abs.startsWith(base + path.sep) && abs !== base) {
    throw new Error('Invalid storage key');
  }
  return abs;
}

async function getS3Client() {
  const { S3Client } = await import('@aws-sdk/client-s3');
  const cfg = loadConfig();
  return new S3Client({
    endpoint: cfg.S3_ENDPOINT,
    region: cfg.S3_REGION ?? 'auto',
    credentials: {
      accessKeyId: cfg.S3_ACCESS_KEY!,
      secretAccessKey: cfg.S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
}

/** Sube un archivo local a S3 si está configurado (no-op en local puro). */
export async function mirrorToS3IfConfigured(relativeKey: string, localAbsPath: string): Promise<void> {
  if (!isS3Configured()) return;
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const cfg = loadConfig();
  const client = await getS3Client();
  const body = await fsPromises.readFile(localAbsPath);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.S3_BUCKET!,
      Key: relativeKey.replace(/\\/g, '/'),
      Body: body,
      ContentType: guessContentType(localAbsPath),
    }),
  );
}

/** Garantiza que el archivo exista en disco local; descarga desde S3 si hace falta. */
export async function ensureLocalFile(relativeKey: string): Promise<string | null> {
  const abs = resolveLocalStoragePath(relativeKey);
  if (fs.existsSync(abs)) return abs;

  if (!isS3Configured()) return null;

  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const cfg = loadConfig();
  const client = await getS3Client();
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: cfg.S3_BUCKET!,
        Key: relativeKey.replace(/\\/g, '/'),
      }),
    );
    if (!response.Body) return null;
    await fsPromises.mkdir(path.dirname(abs), { recursive: true });
    const bytes = await response.Body.transformToByteArray();
    await fsPromises.writeFile(abs, bytes);
    return abs;
  } catch {
    return null;
  }
}

/** Guarda bytes en storage local y opcionalmente en S3. Devuelve ruta absoluta local. */
export async function writeStorageFile(relativeKey: string, data: Buffer): Promise<string> {
  const abs = resolveLocalStoragePath(relativeKey);
  await fsPromises.mkdir(path.dirname(abs), { recursive: true });
  await fsPromises.writeFile(abs, data);
  await mirrorToS3IfConfigured(relativeKey, abs);
  return abs;
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

/** URL pública opcional para servir media desde CDN/S3 (requiere CDN_URL o S3_PUBLIC_URL). */
export function getPublicMediaUrl(relativeKey: string): string | null {
  const cfg = loadConfig();
  const base = cfg.CDN_URL?.trim() || cfg.S3_PUBLIC_URL?.trim();
  if (!base) return null;
  const key = relativeKey.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${base.replace(/\/+$/, '')}/${key}`;
}
