import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EdgeTTS } from '@andresaya/edge-tts';
import type { TtsProvider, TtsSynthesisOptions } from './types.js';
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

export const edgeProvider: TtsProvider = {
  name: 'edge',

  async synthesize({ text, language, outPath, config, retentionMode }: TtsSynthesisOptions): Promise<void> {
    const voice = resolveEdgeVoice(language, config.EDGE_TTS_VOICE);
    const rate = retentionMode ? bumpEdgeRate(config.EDGE_TTS_RATE) : config.EDGE_TTS_RATE;

    console.info(`[media/TTS/edge] voice=${voice} lang=${language} rate=${rate}`);

    const tts = new EdgeTTS();
    await tts.synthesize(text, voice, {
      rate,
      volume: config.EDGE_TTS_VOLUME,
      pitch: config.EDGE_TTS_PITCH,
    });

    const rawBase = path.join(os.tmpdir(), `autotube-edge-${Date.now()}`);
    const rawPath = await tts.toFile(rawBase);

    try {
      await postProcessTtsAudio(rawPath, outPath);
    } finally {
      await fs.unlink(rawPath).catch(() => undefined);
    }
  },
};
