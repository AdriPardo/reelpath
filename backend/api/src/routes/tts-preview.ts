import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { generateSpeech } from '@autotube/media-generator';
import { orgScope } from '../middleware/auth.js';
import {
  readTtsPreviewCache,
  ttsPreviewCacheKey,
  writeTtsPreviewCache,
} from '../lib/tts-preview-cache.js';

const previewSchema = z.object({
  provider: z.enum(['edge', 'elevenlabs', 'openai']).default('edge'),
  voiceId: z.string().min(2).max(120),
  text: z.string().min(1).max(220).optional(),
  language: z.string().min(2).max(12).optional(),
});

const DEFAULT_TEXT_ES =
  'Hola. Esta es una prueba de voz para tu canal en Reelpath.';
const DEFAULT_TEXT_EN =
  'Hello. This is a voice preview for your Reelpath channel.';

/**
 * Genera clip corto TTS (Edge / OpenAI / ElevenLabs). Devuelve audio/mpeg.
 * Reusa cache en disco/memoria por fingerprint (provider+voz+texto+lang).
 */
export async function handleTtsPreview(req: Request, res: Response) {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Organización no definida' });
  }

  const body = previewSchema.parse(req.body);
  const language = body.language?.trim() || 'es';
  const text =
    body.text?.trim() ||
    (language.startsWith('en') ? DEFAULT_TEXT_EN : DEFAULT_TEXT_ES);

  const cacheKey = ttsPreviewCacheKey({
    provider: body.provider,
    voiceId: body.voiceId,
    text,
    language,
  });

  const cached = await readTtsPreviewCache(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-TTS-Cache', cached.hit);
    return res.send(cached.buf);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reelpath-tts-'));
  const outPath = path.join(tmpDir, `${randomUUID()}.mp3`);

  try {
    const result = await generateSpeech(text, outPath, {
      language,
      provider: body.provider,
      voiceId: body.voiceId,
    });

    const buf = await fs.readFile(outPath);
    if (!buf.length) {
      return res.status(502).json({ error: 'TTS devolvió audio vacío' });
    }

    if (!result.mock) {
      await writeTtsPreviewCache(cacheKey, buf).catch(() => undefined);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-TTS-Provider', result.provider);
    res.setHeader('X-TTS-Mock', result.mock ? '1' : '0');
    res.setHeader('X-TTS-Cache', 'miss');
    res.send(buf);
  } catch (err) {
    console.error('[tts/preview]', err);
    const message = err instanceof Error ? err.message : 'No se pudo generar preview TTS';
    res.status(502).json({ error: message });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
