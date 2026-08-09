import { Router, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { getStoragePath } from '@autotube/config';
import { prisma } from '@autotube/database';
import { listBgmFiles } from '@autotube/video-renderer';
import { authMiddleware, orgScope } from '../middleware/auth.js';

export const bgmRouter = Router({ mergeParams: true });

const MAX_BGM_BYTES = 30 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BGM_BYTES, files: 1 },
});

bgmRouter.use(authMiddleware);

async function requireChannel(req: Request) {
  const orgId = orgScope(req);
  const channelId = String(req.params.id);
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return null;
  if (orgId && channel.organizationId !== orgId) return null;
  return channel;
}

bgmRouter.get('/', async (req, res) => {
  const channel = await requireChannel(req);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const files = await listBgmFiles();
  res.json({
    tracks: files.map((f) => {
      const normalized = f.replace(/\\/g, '/');
      const isResource =
        normalized.includes('/resource/bgm/') ||
        normalized.includes('/resource/bgm') ||
        /(^|\/)resource\/bgm\//.test(normalized);
      return {
        name: path.basename(f),
        source: isResource ? 'resource' : 'storage',
      };
    }),
  });
});

bgmRouter.post('/', (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: unknown) => {
    if (err) {
      const msg =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Archivo BGM supera 30 MB'
          : err instanceof Error
            ? err.message
            : 'Error de upload';
      return res.status(400).json({ error: msg });
    }

    try {
      const channel = await requireChannel(req);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const file = req.file;
      if (!file?.buffer?.length) {
        return res.status(400).json({ error: 'Falta archivo audio' });
      }

      const original = (file.originalname || 'track.mp3').replace(/\\/g, '/').split('/').pop()!;
      const ext = path.extname(original).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return res.status(400).json({
          error: `Formato no soportado. Usa: ${[...ALLOWED_EXT].join(', ')}`,
        });
      }

      const safeBase = original
        .replace(ext, '')
        .replace(/[^\w\-áéíóúñüÁÉÍÓÚÑÜ]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      const storedName = `${safeBase || 'bgm'}-${randomUUID().slice(0, 8)}${ext}`;
      const dir = getStoragePath('bgm');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, storedName), file.buffer);

      res.status(201).json({
        name: storedName,
        message: 'Track BGM subido',
      });
    } catch (e) {
      console.error('[bgm/upload]', e);
      res.status(500).json({ error: 'No se pudo guardar el BGM' });
    }
  });
});

bgmRouter.delete('/:name', async (req, res) => {
  const channel = await requireChannel(req);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const name = path.basename(String(req.params.name || ''));
  if (!name || name.startsWith('.') || !ALLOWED_EXT.has(path.extname(name).toLowerCase())) {
    return res.status(400).json({ error: 'Nombre de track inválido' });
  }

  const target = path.join(getStoragePath('bgm'), name);
  const resolved = path.resolve(target);
  const root = path.resolve(getStoragePath('bgm'));
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return res.status(400).json({ error: 'Ruta inválida' });
  }

  try {
    await fs.unlink(resolved);
    res.json({ message: 'Track eliminado', name });
  } catch {
    res.status(404).json({ error: 'Track no encontrado en storage/bgm' });
  }
});
