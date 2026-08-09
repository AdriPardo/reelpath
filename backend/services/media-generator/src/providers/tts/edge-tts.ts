import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EdgeTTS, type WordBoundary } from '@andresaya/edge-tts';
import type { TtsProvider, TtsSynthesisOptions, TtsSynthesisResult } from './types.js';
import { postProcessTtsAudio } from '../../ffmpeg-utils.js';

function resolveEdgeVoice(language: string, configuredVoice: string): string {
  if (configuredVoice) return configuredVoice;

  if (language.startsWith('es-MX')) return 'es-MX-DaliaNeural';
  if (language.startsWith('es')) return 'es-ES-ElviraNeural';
  return 'en-US-EmmaMultilingualNeural';
}

function bumpEdgeRate(rate: string): string {
  const match = rate.match(/^([+-]?)(\d+)%$/);
  if (!match) return '+5%';
  const signed = (match[1] === '-' ? -1 : 1) * Number(match[2]);
  const value = Math.max(0, signed + 5);
  return `+${value}%`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutSec: number, label: string): Promise<T> {
  if (timeoutSec <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timeout after ${timeoutSec}s`)),
          timeoutSec * 1000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function unlinkIfEmptyOrMissing(filePath: string): Promise<void> {
  try {
    const st = await fs.stat(filePath);
    if (st.size === 0) {
      await fs.unlink(filePath).catch(() => undefined);
      throw new Error(`Edge TTS wrote empty audio: ${filePath}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('empty audio')) throw err;
    // missing file → caller handles
  }
}

async function synthesizeOnce(
  text: string,
  voice: string,
  rate: string,
  volume: string,
  pitch: string,
  outPath: string,
  timeoutSec: number,
): Promise<TtsSynthesisResult> {
  const tts = new EdgeTTS();
  await withTimeout(
    tts.synthesize(text, voice, { rate, volume, pitch }),
    timeoutSec,
    'Edge TTS synthesize',
  );

  const rawBase = path.join(os.tmpdir(), `autotube-edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const rawPath = await withTimeout(tts.toFile(rawBase), timeoutSec, 'Edge TTS toFile');

  try {
    await unlinkIfEmptyOrMissing(rawPath);
    await postProcessTtsAudio(rawPath, outPath);
    await unlinkIfEmptyOrMissing(outPath);

    const boundaries = tts.getWordBoundaries() as WordBoundary[];
    return {
      wordBoundaries: boundaries.map((b) => ({
        text: b.text,
        offset: b.offset,
        duration: b.duration,
      })),
    };
  } finally {
    await fs.unlink(rawPath).catch(() => undefined);
  }
}

export const edgeProvider: TtsProvider = {
  name: 'edge',

  async synthesize({
    text,
    language,
    outPath,
    config,
    retentionMode,
  }: TtsSynthesisOptions): Promise<TtsSynthesisResult> {
    const voice = resolveEdgeVoice(language, config.EDGE_TTS_VOICE);
    const rate = retentionMode ? bumpEdgeRate(config.EDGE_TTS_RATE) : config.EDGE_TTS_RATE;
    const timeoutSec = config.EDGE_TTS_TIMEOUT_SEC ?? 30;
    const retries = config.EDGE_TTS_RETRIES ?? 2;
    const attempts = Math.max(1, retries + 1);

    console.info(
      `[media/TTS/edge] voice=${voice} lang=${language} rate=${rate} timeout=${timeoutSec}s attempts=${attempts}`,
    );

    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const result = await synthesizeOnce(
          text,
          voice,
          rate,
          config.EDGE_TTS_VOLUME,
          config.EDGE_TTS_PITCH,
          outPath,
          timeoutSec,
        );
        if (attempt > 1) {
          console.info(`[media/TTS/edge] ok on attempt ${attempt}`);
        }
        return result;
      } catch (err) {
        lastError = err;
        await fs.unlink(outPath).catch(() => undefined);
        console.warn(
          `[media/TTS/edge] attempt ${attempt}/${attempts} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Edge TTS failed after ${attempts} attempts`);
  },
};
