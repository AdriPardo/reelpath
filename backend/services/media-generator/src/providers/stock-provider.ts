import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { loadConfig } from '@autotube/config';
import { buildLanczosScaleCrop, VIDEO_RESOLUTION_LONG, VIDEO_RESOLUTION_SHORT } from '@autotube/shared';
import type { VisualOrigin } from '@autotube/shared';
import { generateSceneImage } from './media-providers.js';

const execFileAsync = promisify(execFile);

export type SceneVisualSource = 'image' | 'stock';
export type SceneAssetType = 'image' | 'video';

export interface ResolveSceneVisualParams {
  visualPrompt: string;
  narration: string;
  imageOutPath: string;
  videoOutPath: string;
  sceneIndex: number;
  aspectRatio: '9:16' | '16:9';
  preferredSource?: SceneVisualSource;
  forceAiImages?: boolean;
}

function stockSearchQuery(visualPrompt: string, narration: string): string {
  const base = visualPrompt.trim() || narration.trim();
  return base
    .replace(/[^\w\sáéíóúñü]/gi, ' ')
    .split(/\s+/)
    .slice(0, 6)
    .join(' ')
    .trim();
}

function targetResolution(aspectRatio: '9:16' | '16:9'): { width: number; height: number } {
  return aspectRatio === '9:16' ? { ...VIDEO_RESOLUTION_SHORT } : { ...VIDEO_RESOLUTION_LONG };
}

async function fetchPexelsVideo(
  query: string,
  aspectRatio: '9:16' | '16:9',
): Promise<string | null> {
  const apiKey = loadConfig().PEXELS_API_KEY?.trim();
  if (!apiKey) return null;

  const orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape';
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query || 'documentary');
  url.searchParams.set('per_page', '5');
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('size', 'medium');

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    console.warn(`[stock-provider] Pexels Videos error ${res.status}`);
    return null;
  }

  const json = (await res.json()) as {
    videos?: Array<{
      video_files?: Array<{
        link?: string;
        file_type?: string;
        width?: number;
        height?: number;
        quality?: string;
      }>;
    }>;
  };

  const { width: targetW, height: targetH } = targetResolution(aspectRatio);
  const minHeight = aspectRatio === '9:16' ? 720 : 720;

  let bestUrl: string | null = null;
  let bestScore = -1;

  for (const video of json.videos ?? []) {
    for (const file of video.video_files ?? []) {
      if (file.file_type !== 'video/mp4' || !file.link || !file.width || !file.height) continue;
      if (file.height < minHeight) continue;

      const overscale =
        file.width > targetW * 1.5 || file.height > targetH * 1.5 ? 0.85 : 1;
      const sizeScore = Math.min(file.width, targetW) * Math.min(file.height, targetH);
      const qualityBonus = file.quality === 'hd' ? 1.1 : 1;
      const score = sizeScore * overscale * qualityBonus;

      if (score > bestScore) {
        bestScore = score;
        bestUrl = file.link;
      }
    }
  }

  return bestUrl;
}

async function fetchPexelsImage(
  query: string,
  aspectRatio: '9:16' | '16:9',
): Promise<string | null> {
  const apiKey = loadConfig().PEXELS_API_KEY?.trim();
  if (!apiKey) return null;

  const orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape';
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query || 'documentary');
  url.searchParams.set('per_page', '1');
  url.searchParams.set('orientation', orientation);

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    console.warn(`[stock-provider] Pexels Photos error ${res.status}`);
    return null;
  }

  const json = (await res.json()) as {
    photos?: Array<{ src?: { large2x?: string; large?: string; original?: string } }>;
  };
  const photo = json.photos?.[0];
  return photo?.src?.large2x ?? photo?.src?.large ?? photo?.src?.original ?? null;
}

async function downloadToFile(fileUrl: string, outPath: string): Promise<void> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buffer);
}

async function normalizeVideoClip(
  inputPath: string,
  outPath: string,
  aspectRatio: '9:16' | '16:9',
): Promise<void> {
  const { width, height } = targetResolution(aspectRatio);
  const scaleCrop = buildLanczosScaleCrop(width, height);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await execFileAsync('ffmpeg', [
    '-i',
    inputPath,
    '-an',
    '-vf',
    `${scaleCrop},fps=30`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-y',
    outPath,
  ]);
}

/**
 * Resuelve el visual de una escena.
 * Con `preferredSource: 'stock'` y `PEXELS_API_KEY`, descarga clip de vídeo Pexels (fallback foto, luego IA).
 */
export async function resolveSceneVisual(params: ResolveSceneVisualParams): Promise<{
  path: string;
  source: SceneVisualSource;
  assetType: SceneAssetType;
  visualOrigin: VisualOrigin;
}> {
  if (params.preferredSource === 'stock') {
    const query = stockSearchQuery(params.visualPrompt, params.narration);
    const apiKey = loadConfig().PEXELS_API_KEY?.trim();

    if (!apiKey) {
      console.info(
        `[stock-provider] scene=${params.sceneIndex} sin PEXELS_API_KEY; fallback a imagen IA`,
      );
    }

    const videoUrl = apiKey ? await fetchPexelsVideo(query, params.aspectRatio) : null;
    if (videoUrl) {
      const rawPath = params.videoOutPath.replace(/\.mp4$/, '-raw.mp4');
      try {
        await downloadToFile(videoUrl, rawPath);
        await normalizeVideoClip(rawPath, params.videoOutPath, params.aspectRatio);
        await fs.unlink(rawPath).catch(() => {});
        console.info(
          `[stock-provider] scene=${params.sceneIndex} Pexels VIDEO OK query="${query}"`,
        );
        return { path: params.videoOutPath, source: 'stock', assetType: 'video', visualOrigin: 'stock' };
      } catch (err) {
        console.warn(
          `[stock-provider] scene=${params.sceneIndex} fallo vídeo Pexels:`,
          err instanceof Error ? err.message : err,
        );
        await fs.unlink(rawPath).catch(() => {});
        await fs.unlink(params.videoOutPath).catch(() => {});
      }
    }

    const imageUrl = apiKey ? await fetchPexelsImage(query, params.aspectRatio) : null;
    if (imageUrl) {
      try {
        await downloadToFile(imageUrl, params.imageOutPath);
        console.info(
          `[stock-provider] scene=${params.sceneIndex} Pexels PHOTO fallback query="${query}"`,
        );
        return { path: params.imageOutPath, source: 'stock', assetType: 'image', visualOrigin: 'stock' };
      } catch (err) {
        console.warn(
          `[stock-provider] scene=${params.sceneIndex} fallo foto Pexels:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.info(
      `[stock-provider] scene=${params.sceneIndex} sin stock Pexels; fallback a imagen IA`,
    );
  }

  const imageResult = await generateSceneImage({
    visualPrompt: params.visualPrompt,
    narration: params.narration,
    outPath: params.imageOutPath,
    sceneIndex: params.sceneIndex,
    aspectRatio: params.aspectRatio,
    forceAiImages: params.forceAiImages,
  });

  return {
    path: params.imageOutPath,
    source: 'image',
    assetType: 'image',
    visualOrigin: imageResult.visualOrigin,
  };
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
