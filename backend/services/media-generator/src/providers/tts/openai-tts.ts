import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import OpenAI from 'openai';
import type { TtsProvider, TtsSynthesisOptions } from './types.js';
import { postProcessTtsAudio } from '../../ffmpeg-utils.js';

export const openAiProvider: TtsProvider = {
  name: 'openai',

  async synthesize({ text, outPath, config, retentionMode }: TtsSynthesisOptions): Promise<void> {
    if (!config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for OpenAI TTS');
    }

    const speed = retentionMode
      ? Math.min(1.15, config.OPENAI_TTS_SPEED * 1.08)
      : config.OPENAI_TTS_SPEED;

    console.info(
      `[media/TTS/openai] voice=${config.OPENAI_TTS_VOICE} model=${config.OPENAI_TTS_MODEL} speed=${speed}`,
    );

    const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    const response = await client.audio.speech.create({
      model: config.OPENAI_TTS_MODEL,
      voice: config.OPENAI_TTS_VOICE as 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer',
      input: text,
      response_format: 'mp3',
      speed,
    });

    const rawPath = path.join(os.tmpdir(), `autotube-openai-${Date.now()}.mp3`);
    try {
      await fs.writeFile(rawPath, Buffer.from(await response.arrayBuffer()));
      await postProcessTtsAudio(rawPath, outPath);
    } finally {
      await fs.unlink(rawPath).catch(() => undefined);
    }
  },
};
