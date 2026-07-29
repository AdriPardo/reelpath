import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEffectiveConfig } from '@autotube/config';
import {
  buildLanczosScaleCrop,
  VIDEO_RESOLUTION_LONG,
  VIDEO_RESOLUTION_SHORT,
} from '@autotube/shared';
import { runFfmpeg } from '@autotube/shared/ffmpeg-runner';
import type { VisualOrigin } from '@autotube/shared';
import { createSceneVisualPng } from '../png-utils.js';
import { preprocessForTts } from '../tts-preprocess.js';
import { getTtsFallbackChain, resolveTtsProvider } from './tts/index.js';
import OpenAI from 'openai';

type ImageSize =
  | '1024x1024'
  | '1024x1536'
  | '1536x1024'
  | '1792x1024'
  | '1024x1792'
  | 'auto';

function imageModelsToTry(configured: string): string[] {
  const models = [configured, 'gpt-image-1', 'dall-e-3', 'dall-e-2'];
  return [...new Set(models.filter(Boolean))];
}

function imageSizeForModel(model: string, aspectRatio: '9:16' | '16:9'): ImageSize {
  if (model.startsWith('gpt-image')) {
    return aspectRatio === '9:16' ? '1024x1536' : '1536x1024';
  }
  if (model === 'dall-e-2') return '1024x1024';
  return aspectRatio === '9:16' ? '1024x1792' : '1792x1024';
}

function aspectLabel(aspectRatio: '9:16' | '16:9'): string {
  return aspectRatio === '9:16' ? 'vertical 9:16' : 'horizontal 16:9';
}

const GENERIC_VISUAL_PATTERN =
  /^(cinematic|dramatic|historical|16:9|9:16|no text|photorealistic)/i;

function isGenericVisualPrompt(visualPrompt: string): boolean {
  const t = visualPrompt.trim();
  if (t.length < 35) return true;
  if (/cinematic,?\s*dramatic lighting,?\s*historical/i.test(t) && t.split(/\s+/).length < 12) {
    return true;
  }
  return GENERIC_VISUAL_PATTERN.test(t) && t.split(/\s+/).length < 10;
}

function buildImagePrompt(
  visualPrompt: string,
  narration: string,
  sceneIndex: number,
  aspectRatio: '9:16' | '16:9',
): string {
  const style = `Cinematic historical documentary, ${aspectLabel(aspectRatio)}, dramatic lighting, photorealistic, no text, no watermark`;

  if (!isGenericVisualPrompt(visualPrompt)) {
    return `${visualPrompt.trim()}. ${style}`;
  }

  const sceneHint = narration.trim().slice(0, 280);
  return `Historical documentary scene ${sceneIndex + 1}: ${sceneHint}. ${style}`;
}

async function saveGeneratedImage(
  item: OpenAI.Images.Image | undefined,
  outPath: string,
): Promise<void> {
  if (!item) throw new Error('Empty image response');

  if (item.b64_json) {
    await fs.writeFile(outPath, Buffer.from(item.b64_json, 'base64'));
  } else if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    await fs.writeFile(outPath, Buffer.from(await res.arrayBuffer()));
  } else {
    throw new Error('No image URL or b64_json in response');
  }

  await stripImageMetadata(outPath);
}

/** Escala imágenes IA (~1536px) a resolución de vídeo con Lanczos (mejor nitidez). */
async function upscaleImageToTarget(
  filePath: string,
  width: number,
  height: number,
): Promise<void> {
  // ffmpeg needs a known image extension to pick the muxer (.tmp alone fails).
  const tmpPath = `${filePath}.upscaled.tmp.png`;
  try {
    await runFfmpeg([
      '-i', filePath,
      '-vf', buildLanczosScaleCrop(width, height),
      '-y', tmpPath,
    ]);
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    console.warn('[media/image] upscale failed, using provider resolution:', err);
  }
}

/** Remove EXIF/C2PA container metadata from provider-generated images. */
async function stripImageMetadata(filePath: string): Promise<void> {
  const tmpPath = `${filePath}.meta.tmp.png`;
  try {
    await runFfmpeg([
      '-i', filePath,
      '-map_metadata', '-1',
      '-y', tmpPath,
    ]);
    await fs.rename(tmpPath, filePath);
  } catch {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

export async function generateSpeech(
  text: string,
  outPath: string,
  options?: { language?: string; retentionMode?: boolean },
): Promise<{ mock: boolean; provider: string }> {
  const config = loadEffectiveConfig();
  const language = options?.language ?? 'es';
  const ttsInput = preprocessForTts(text, language);

  if (config.MOCK_EXTERNAL_APIS) {
    await generateSilentAudio(outPath, estimateDuration(ttsInput));
    return { mock: true, provider: 'mock' };
  }

  const chain = getTtsFallbackChain(config);
  if (chain.length === 0) {
    await generateSilentAudio(outPath, estimateDuration(ttsInput));
    return { mock: true, provider: 'mock' };
  }

  console.info(
    `[media/TTS] provider=${resolveTtsProvider(config)} lang=${language} chain=${chain.map((p) => p.name).join('→')}`,
  );
  console.info(`[media/TTS] input: ${ttsInput}`);
  if (ttsInput !== text.trim()) {
    console.info(`[media/TTS] original: ${text.trim()}`);
  }

  let lastError: unknown;
  for (const provider of chain) {
    try {
      await provider.synthesize({
        text: ttsInput,
        language,
        outPath,
        config,
        retentionMode: options?.retentionMode,
      });
      return { mock: false, provider: provider.name };
    } catch (err) {
      lastError = err;
      console.warn(
        `[media/TTS] ${provider.name} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.warn('[media/TTS] All providers failed, using silent mock:', lastError);
  await generateSilentAudio(outPath, estimateDuration(ttsInput));
  return { mock: true, provider: 'mock' };
}

export async function generateSceneImage(params: {
  visualPrompt: string;
  narration: string;
  outPath: string;
  sceneIndex: number;
  aspectRatio?: '9:16' | '16:9';
  /**
   * Force AI images when GENERATE_DALLE_IMAGES=false (e.g. FORCE_AI_IMAGES_ON_PAID).
   * Ignored when allowAiImages=false (per-video cap).
   */
  forceAiImages?: boolean;
  /** When false, skip AI even if GENERATE_DALLE_IMAGES=true (e.g. MAX_AI_IMAGES_PER_VIDEO). */
  allowAiImages?: boolean;
}): Promise<{ mock: boolean; provider?: string; visualOrigin: VisualOrigin }> {
  const config = loadEffectiveConfig();
  const aspectRatio = params.aspectRatio ?? '16:9';
  const isVertical = aspectRatio === '9:16';
  const { width, height } = isVertical ? VIDEO_RESOLUTION_SHORT : VIDEO_RESOLUTION_LONG;

  const allowAi = params.allowAiImages !== false;
  const useAiImages =
    allowAi &&
    !config.useMocks &&
    !!config.OPENAI_API_KEY &&
    (config.GENERATE_DALLE_IMAGES || !!params.forceAiImages);

  if (!useAiImages) {
    if (
      config.OPENAI_API_KEY &&
      !config.useMocks &&
      !config.GENERATE_DALLE_IMAGES &&
      !params.forceAiImages
    ) {
      console.info(
        '[media] GENERATE_DALLE_IMAGES=false — imágenes procedurales/stock. ' +
          'Pon GENERATE_DALLE_IMAGES=true (y opcionalmente FORCE_AI_IMAGES_ON_PAID) para imágenes IA.',
      );
    } else if (!allowAi) {
      console.info(
        `[media] scene=${params.sceneIndex} tope MAX_AI_IMAGES_PER_VIDEO — procedural/stock`,
      );
    } else {
      console.info('[media] Imágenes procedurales (sin API key o mocks activos)');
    }
    await generateProceduralSceneImage({ ...params, width, height });
    return { mock: true, provider: 'procedural', visualOrigin: 'placeholder' };
  }

  const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  const prompt = buildImagePrompt(
    params.visualPrompt,
    params.narration,
    params.sceneIndex,
    aspectRatio,
  );
  let lastError: unknown;
  const imageQuality = config.OPENAI_IMAGE_QUALITY;

  for (const model of imageModelsToTry(config.OPENAI_IMAGE_MODEL)) {
    try {
      const size = imageSizeForModel(model, aspectRatio);
      console.info(
        `[media/image] scene=${params.sceneIndex} model=${model} size=${size} quality=${imageQuality}`,
      );
      if (isGenericVisualPrompt(params.visualPrompt)) {
        console.info(`[media/image] scene=${params.sceneIndex} generic visualPrompt — using narration context`);
      }

      const result = await client.images.generate({
        model,
        prompt,
        size,
        quality: model.startsWith('gpt-image') ? imageQuality : 'standard',
        n: 1,
      });

      await saveGeneratedImage(result.data?.[0], params.outPath);
      await upscaleImageToTarget(params.outPath, width, height);
      console.info(`[media/image] scene=${params.sceneIndex} ok model=${model}`);
      return { mock: false, provider: model, visualOrigin: 'ai' };
    } catch (err) {
      lastError = err;
      console.warn(
        `[media/image] scene=${params.sceneIndex} model=${model} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.warn('[media/image] All models failed, using procedural fallback:', lastError);
  await generateProceduralSceneImage({ ...params, width, height });
  return { mock: true, provider: 'procedural', visualOrigin: 'placeholder' };
}

async function generateProceduralSceneImage(params: {
  outPath: string;
  sceneIndex: number;
  visualPrompt: string;
  width: number;
  height: number;
}): Promise<void> {
  const png = createSceneVisualPng(params.width, params.height, params.sceneIndex, params.visualPrompt);
  await fs.writeFile(params.outPath, png);
}

function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(3, Math.min(90, words * 0.45));
}

async function generateSilentAudio(outPath: string, durationSec: number): Promise<void> {
  await runFfmpeg([
    '-f',
    'lavfi',
    '-i',
    `anullsrc=r=44100:cl=mono:d=${durationSec}`,
    '-c:a',
    'libmp3lame',
    '-y',
    outPath,
  ]);
}

export async function writeSceneSubtitle(
  outPath: string,
  text: string,
  durationSec: number,
  options?: {
    retentionMode?: boolean;
    templatePosition?: 'bottom' | 'center';
  },
): Promise<void> {
  const { buildKaraokeAssForScene } = await import('@autotube/shared');
  const fontSize = options?.retentionMode ? 38 : 42;
  const alignment = options?.templatePosition === 'center' ? 5 : 2;
  const marginV = options?.templatePosition === 'center' ? 180 : options?.retentionMode ? 86 : 64;
  const content = buildKaraokeAssForScene(text, durationSec, { fontSize, alignment, marginV });
  await fs.writeFile(outPath, content, 'utf-8');
}

function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
