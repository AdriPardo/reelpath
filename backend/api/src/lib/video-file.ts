import fs from 'node:fs';
import path from 'node:path';
import type { Response } from 'express';
import { loadConfig, ensureLocalFile, getPublicMediaUrl } from '@autotube/config';

export function resolveVideoFile(filePath: string): string | null {
  const abs = path.resolve(filePath);
  const storageRoot = path.resolve(loadConfig().STORAGE_PATH);

  if (!abs.startsWith(storageRoot + path.sep) && abs !== storageRoot) {
    return null;
  }

  if (fs.existsSync(abs)) return abs;

  const relativeKey = path.relative(storageRoot, abs);
  if (relativeKey.startsWith('..')) return null;

  // S3: intentará descargar bajo demanda (sync en siguiente llamada a streamVideoFile).
  return abs;
}

export async function resolveVideoFileAsync(filePath: string): Promise<string | null> {
  const abs = resolveVideoFile(filePath);
  if (!abs) return null;
  if (fs.existsSync(abs)) return abs;

  const storageRoot = path.resolve(loadConfig().STORAGE_PATH);
  const relativeKey = path.relative(storageRoot, abs);
  return ensureLocalFile(relativeKey);
}

export function streamVideoFile(filePath: string, res: Response, rangeHeader?: string): void {
  void streamVideoFileAsync(filePath, res, rangeHeader);
}

export async function streamVideoFileAsync(
  filePath: string,
  res: Response,
  rangeHeader?: string,
): Promise<void> {
  const abs = await resolveVideoFileAsync(filePath);
  if (!abs) {
    res.status(404).json({ error: 'Video file not found' });
    return;
  }

  const stat = fs.statSync(abs);
  if (!stat.isFile()) {
    res.status(404).json({ error: 'Video file not found' });
    return;
  }

  const storageRoot = path.resolve(loadConfig().STORAGE_PATH);
  const relativeKey = path.relative(storageRoot, abs);
  const cdnUrl =
    !relativeKey.startsWith('..') ? getPublicMediaUrl(relativeKey.replace(/\\/g, '/')) : null;
  if (cdnUrl) {
    res.redirect(302, cdnUrl);
    return;
  }

  const ext = path.extname(abs).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    streamImageFile(abs, res);
    return;
  }

  if (ext !== '.mp4') {
    res.status(415).json({ error: 'Preview not available for this file format' });
    return;
  }

  const fileSize = stat.size;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunkSize,
    });
    fs.createReadStream(abs, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Length': fileSize });
  fs.createReadStream(abs).pipe(res);
}

export function streamImageFile(filePath: string, res: Response): void {
  void streamImageFileAsync(filePath, res);
}

export async function streamImageFileAsync(filePath: string, res: Response): Promise<void> {
  const abs = await resolveVideoFileAsync(filePath);
  if (!abs) {
    res.status(404).json({ error: 'Image file not found' });
    return;
  }

  const ext = path.extname(abs).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(abs).pipe(res);
}
