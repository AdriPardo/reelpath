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
import { downloadFalImageToFile, generateFalFluxImage } from './fal-flux-image.js';
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
  options?: {
    language?: string;
    retentionMode?: boolean;
    /** Fuerza provider (preview / tests). */
    provider?: 'edge' | 'elevenlabs' | 'openai';
    /** Fuerza voz concreta del provider. */
    voiceId?: string;
  },
): Promise<{ mock: boolean; provider: string; wordBoundaries?: import('@autotube/shared').WordBoundaryLike[] }> {
  const config = { ...loadEffectiveConfig() };
  if (options?.provider) {
    config.TTS_PROVIDER = options.provider;
  }
  if (options?.voiceId?.trim()) {
    const voice = options.voiceId.trim();
    const provider = options.provider ?? resolveTtsProvider(config);
    if (provider === 'elevenlabs') config.ELEVENLABS_VOICE_ID = voice;
    else if (provider === 'openai') config.OPENAI_TTS_VOICE = voice;
    else config.EDGE_TTS_VOICE = voice;
  }
  const language = options?.language ?? 'es';
  const ttsInput = preprocessForTts(text, language);

  const chain = getTtsFallbackChain(config);
  if (chain.length === 0) {
    if (config.MOCK_EXTERNAL_APIS) {
      console.warn('[media/TTS] MOCK — audio silencioso (sin providers TTS)');
      await generateSilentAudio(outPath, estimateDuration(ttsInput));
      return { mock: true, provider: 'mock' };
    }
    throw new Error(
      'Sin provider TTS usable. Activa Edge TTS, o configura ElevenLabs/OpenAI en Secretos de plataforma / canal.',
    );
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
      const result = await provider.synthesize({
        text: ttsInput,
        language,
        outPath,
        config,
        retentionMode: options?.retentionMode,
      });
      // Drop empty outputs before accepting provider success.
      try {
        const st = await fs.stat(outPath);
        if (st.size === 0) {
          await fs.unlink(outPath).catch(() => undefined);
          throw new Error(`${provider.name} wrote empty audio`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('empty audio')) throw err;
        throw new Error(`${provider.name} did not write audio file`);
      }
      return {
        mock: false,
        provider: provider.name,
        wordBoundaries: result?.wordBoundaries,
      };
    } catch (err) {
      lastError = err;
      await fs.unlink(outPath).catch(() => undefined);
      console.warn(
        `[media/TTS] ${provider.name} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown');
  if (config.MOCK_EXTERNAL_APIS) {
    console.warn('[media/TTS] All providers failed, using silent mock:', detail);
    await generateSilentAudio(outPath, estimateDuration(ttsInput));
    return { mock: true, provider: 'mock' };
  }

  // Producción: no generar vídeo mudo. Mejor fallar el pipeline con error claro.
  throw new Error(
    `TTS falló (${chain.map((p) => p.name).join('→')}): ${detail}. ` +
      'Revisa Edge TTS / ElevenLabs / OpenAI en Admin → Secretos, o el proveedor TTS del canal.',
  );
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
  const falKey = config.FAL_KEY?.trim() || config.FAL_API_KEY?.trim() || '';
  const openAiKey = config.OPENAI_API_KEY?.trim() || '';
  const imageProvider = config.IMAGE_AI_PROVIDER ?? 'auto';
  const wantFal = imageProvider === 'fal' || imageProvider === 'auto';
  const wantOpenAi = imageProvider === 'openai' || imageProvider === 'auto';
  const hasAiKey = (wantFal && !!falKey) || (wantOpenAi && !!openAiKey);

  // Clave efectiva (org/plataforma/env) gana sobre useMocks: fal o OpenAI habilitan IA.
  const useAiImages =
    allowAi && hasAiKey && (config.GENERATE_DALLE_IMAGES || !!params.forceAiImages);

  if (!useAiImages) {
    if (hasAiKey && !config.GENERATE_DALLE_IMAGES && !params.forceAiImages) {
      console.info(
        '[media] GENERATE_DALLE_IMAGES=false — imágenes procedurales/stock. ' +
          'Activa imágenes IA en Ajustes / canal (Flux Pro / gpt-image).',
      );
    } else if (!allowAi) {
      console.info(
        `[media] scene=${params.sceneIndex} tope MAX_AI_IMAGES_PER_VIDEO — procedural/stock`,
      );
    } else if (!hasAiKey) {
      console.info('[media] Imágenes procedurales (sin FAL_KEY ni OPENAI_API_KEY)');
    } else {
      console.info('[media] Imágenes procedurales/stock');
    }
    await generateProceduralSceneImage({ ...params, width, height });
    return { mock: true, provider: 'procedural', visualOrigin: 'placeholder' };
  }

  const prompt = buildImagePrompt(
    params.visualPrompt,
    params.narration,
    params.sceneIndex,
    aspectRatio,
  );
  if (isGenericVisualPrompt(params.visualPrompt)) {
    console.info(
      `[media/image] scene=${params.sceneIndex} generic visualPrompt — using narration context`,
    );
  }

  let lastError: unknown;

  // 1) Flux Pro (quality-first cheap path) when key present.
  if (wantFal && falKey) {
    const falModel = config.FAL_IMAGE_MODEL?.trim() || 'fal-ai/flux-pro/v1.1';
    try {
      console.info(
        `[media/image] scene=${params.sceneIndex} provider=fal model=${falModel} aspect=${aspectRatio}`,
      );
      const fal = await generateFalFluxImage({
        apiKey: falKey,
        model: falModel,
        prompt,
        aspectRatio,
      });
      await downloadFalImageToFile(fal.url, params.outPath);
      await stripImageMetadata(params.outPath);
      await upscaleImageToTarget(params.outPath, width, height);
      console.info(`[media/image] scene=${params.sceneIndex} ok provider=fal model=${falModel}`);
      return { mock: false, provider: falModel, visualOrigin: 'ai' };
    } catch (err) {
      lastError = err;
      console.warn(
        `[media/image] scene=${params.sceneIndex} fal failed:`,
        err instanceof Error ? err.message : err,
      );
      if (imageProvider === 'fal') {
        console.warn('[media/image] IMAGE_AI_PROVIDER=fal — no OpenAI fallback');
        await generateProceduralSceneImage({ ...params, width, height });
        return { mock: true, provider: 'procedural', visualOrigin: 'placeholder' };
      }
    }
  }

  // 2) OpenAI gpt-image fallback (or primary when IMAGE_AI_PROVIDER=openai).
  if (wantOpenAi && openAiKey) {
    const client = new OpenAI({ apiKey: openAiKey });
    const imageQuality = config.OPENAI_IMAGE_QUALITY;

    for (const model of imageModelsToTry(config.OPENAI_IMAGE_MODEL)) {
      try {
        const size = imageSizeForModel(model, aspectRatio);
        console.info(
          `[media/image] scene=${params.sceneIndex} model=${model} size=${size} quality=${imageQuality}`,
        );

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
  }

  console.warn('[media/image] All AI providers failed, using procedural fallback:', lastError);
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
    wordBoundaries?: import('@autotube/shared').WordBoundaryLike[];
  },
): Promise<void> {
  const {
    buildKaraokeAssForScene,
    buildKaraokeAssFromWordTimings,
    boundariesToWordTimings,
    warnSubtitleStyle,
  } = await import('@autotube/shared');
  const fontSize = options?.retentionMode ? 38 : 42;
  const alignment = options?.templatePosition === 'center' ? 5 : 2;
  const marginV = options?.templatePosition === 'center' ? 180 : options?.retentionMode ? 86 : 64;

  for (const w of warnSubtitleStyle({
    fgHex: '#FFFFFF',
    bgHex: '#111111',
    sampleText: text,
  })) {
    console.warn(`[media/subs] ${w}`);
  }

  const timings = options?.wordBoundaries?.length
    ? boundariesToWordTimings(options.wordBoundaries)
    : [];
  const content =
    timings.length > 0
      ? buildKaraokeAssFromWordTimings(timings, durationSec, { fontSize, alignment, marginV })
      : buildKaraokeAssForScene(text, durationSec, { fontSize, alignment, marginV });

  if (timings.length > 0) {
    console.info(`[media/subs] karaoke WordBoundary cues=${timings.length}`);
  }

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
