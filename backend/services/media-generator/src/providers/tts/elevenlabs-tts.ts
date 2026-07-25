import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { TtsProvider, TtsSynthesisOptions } from './types.js';
import { postProcessTtsAudio } from '../../ffmpeg-utils.js';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

export const elevenLabsProvider: TtsProvider = {
  name: 'elevenlabs',

  async synthesize({ text, outPath, config }: TtsSynthesisOptions): Promise<void> {
    const apiKey = config.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is required for ElevenLabs TTS');
    }

    const voiceId = config.ELEVENLABS_VOICE_ID;
    const modelId = config.ELEVENLABS_MODEL;
    const outputFormat = config.ELEVENLABS_OUTPUT_FORMAT;

    console.info(
      `[media/TTS/elevenlabs] voice=${voiceId} model=${modelId} format=${outputFormat}`,
    );

    const url = new URL(`${ELEVENLABS_API}/text-to-speech/${voiceId}`);
    url.searchParams.set('output_format', outputFormat);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        language_code: config.ELEVENLABS_LANGUAGE_CODE || undefined,
        voice_settings: {
          stability: config.ELEVENLABS_STABILITY,
          similarity_boost: config.ELEVENLABS_SIMILARITY,
          style: config.ELEVENLABS_STYLE,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`ElevenLabs TTS failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const rawPath = path.join(os.tmpdir(), `autotube-elevenlabs-${Date.now()}.mp3`);
    try {
      await fs.writeFile(rawPath, Buffer.from(await response.arrayBuffer()));
      await postProcessTtsAudio(rawPath, outPath);
    } finally {
      await fs.unlink(rawPath).catch(() => undefined);
    }
  },
};
