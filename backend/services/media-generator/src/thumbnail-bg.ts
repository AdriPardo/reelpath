/**
 * Fondo IA dedicado para miniatura YouTube (espacio negativo para texto).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath } from '@autotube/config';
import { buildThumbnailBackgroundPrompt } from '@autotube/shared';
import { generateSceneImage } from './providers/media-providers.js';

export async function generateThumbnailBackground(params: {
  pipelineRunId: string;
  title: string;
  hook?: string;
  angle?: string;
  niche?: string | null;
  aspectRatio?: '16:9' | '9:16';
  forceAiImages?: boolean;
  subdir?: string;
}): Promise<string | null> {
  const aspectRatio = params.aspectRatio ?? '16:9';
  const baseDir = params.subdir
    ? getStoragePath('pipelines', params.pipelineRunId, params.subdir)
    : getStoragePath('pipelines', params.pipelineRunId);
  await fs.mkdir(baseDir, { recursive: true });
  const outPath = path.join(baseDir, 'thumbnail-bg.png');

  const visualPrompt = buildThumbnailBackgroundPrompt({
    title: params.title,
    hook: params.hook,
    angle: params.angle,
    niche: params.niche,
    aspectRatio,
  });

  try {
    const result = await generateSceneImage({
      visualPrompt,
      narration: params.hook || params.angle || params.title,
      outPath,
      sceneIndex: -1,
      aspectRatio,
      niche: params.niche,
      forceAiImages: params.forceAiImages ?? true,
      allowAiImages: true,
    });
    if (result.visualOrigin === 'placeholder' && result.mock) {
      console.info('[thumbnail-bg] sin IA usable — se omite fondo dedicado');
      await fs.unlink(outPath).catch(() => {});
      return null;
    }
    console.info(`[thumbnail-bg] ok provider=${result.provider ?? 'ai'} path=${outPath}`);
    return outPath;
  } catch (err) {
    console.warn(
      '[thumbnail-bg] falló:',
      err instanceof Error ? err.message : err,
    );
    await fs.unlink(outPath).catch(() => {});
    return null;
  }
}
