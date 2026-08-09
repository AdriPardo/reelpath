import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath } from '@autotube/config';
import { prisma } from '@autotube/database';
import { generateMedia } from '@autotube/media-generator';
import { generateTeaserScript } from '@autotube/script-generator';
import type { ChannelConfig } from '@autotube/shared';
import { resolveMixedShortsCounts, resolveShortsPerVideo } from '@autotube/shared';
import {
  applyClipOverlay,
  generateVerticalClipThumbnail,
  getVideoDuration,
  renderVideo,
} from '@autotube/video-renderer';

export interface DedicatedShortResult {
  clipIds: string[];
  count: number;
}

/** Ángulos distintos para cada teaser cuando se generan varios Shorts por vídeo. */
const SHORT_ANGLE_HINTS = [
  'El dato más impactante o contraintuitivo del tema, presentado como una revelación.',
  'Una curiosidad poco conocida o un detalle sorprendente que casi nadie sabe.',
  'Un mito, error común o creencia falsa sobre el tema, desmentido con un giro.',
  'Una pregunta provocadora que obliga a ver el vídeo completo para la respuesta.',
];

function resolveShortsCount(config: ChannelConfig): number {
  return resolveShortsPerVideo(config.shortsPerVideo);
}

export interface GenerateDedicatedShortOptions {
  /** Cuántos teasers generar (por defecto shortsPerVideo del canal). */
  count?: number;
  /** partIndex inicial para no pisar cortes split previos (modo mixto). */
  startPartIndex?: number;
  /** `all`: borra todos los clips; `dedicated-only`: solo partIndex >= startPartIndex. */
  replaceMode?: 'all' | 'dedicated-only';
}

async function buildTeaserClip(params: {
  pipelineRunId: string;
  channelId: string;
  config: ChannelConfig;
  videoId: string;
  partIndex: number;
  variationHint?: string;
  longVideo: { title: string; description: string; hook: string; angle: string };
}): Promise<string> {
  const { pipelineRunId, channelId, config, videoId, partIndex, variationHint, longVideo } = params;
  const subdir = `short-${partIndex}`;

  const teaser = await generateTeaserScript({ config, longVideo, variationHint });
  const displayTitle = teaser.title.replace(/ #Shorts$/i, '');

  const assets = await generateMedia({
    pipelineRunId,
    script: teaser.variant,
    language: config.language,
    aspectRatio: '9:16',
    retentionMode: true,
    videoMotionIntensity: config.videoMotionIntensity,
    visualSourceMode: config.visualSourceMode,
    channelGenerateAiImages: config.generateAiImages,
    channelFalI2vEnabled: config.falI2vEnabled,
    channelMaxFalI2vPerVideo: config.maxFalI2vPerVideo,
    subdir,
    persist: false,
  });

  const rendered = await renderVideo({
    pipelineRunId,
    channelId,
    templateId: config.templateId,
    script: teaser.variant,
    assets,
    title: teaser.title,
    description: teaser.description,
    tags: teaser.tags,
    format: 'shorts',
    aspectRatio: '9:16',
    reviewRequired: false,
    retentionMode: true,
    videoMotionIntensity: config.videoMotionIntensity,
    outputSubdir: subdir,
    persistAsVideo: false,
    mediaSubdir: subdir,
    bgmEnabled: config.bgmEnabled,
    bgmVolume: config.bgmVolume,
    bgmFile: config.bgmFile,
  });

  const shortDir = getStoragePath('videos', pipelineRunId, subdir);
  await fs.mkdir(shortDir, { recursive: true });
  const outPath = path.join(shortDir, 'teaser.mp4');

  await applyClipOverlay({
    inputPath: rendered.filePath,
    outputPath: outPath,
    videoTitle: displayTitle,
    partIndex,
    partCount: 1,
    showPartLabel: false,
  });

  const thumbPath = path.join(shortDir, 'teaser-thumb.jpg');
  let savedThumb: string | null = null;
  try {
    await generateVerticalClipThumbnail({
      title: displayTitle,
      partIndex,
      partCount: 1,
      videoPath: outPath,
      outputPath: thumbPath,
      showPartLabel: false,
    });
    savedThumb = thumbPath;
  } catch (err) {
    console.warn(`[dedicated-short] Thumbnail ${partIndex} failed:`, err);
    savedThumb = rendered.thumbnailPath ?? null;
  }

  const durationSec = await getVideoDuration(outPath);

  const clip = await prisma.videoClip.create({
    data: {
      videoId,
      pipelineRunId,
      partIndex,
      title: teaser.title,
      filePath: outPath,
      thumbnailPath: savedThumb,
      durationSec,
      aspectRatio: '9:16',
      platform: 'short_source',
      publishStatus: 'pending',
    },
  });

  console.info(
    `[dedicated-short] pipeline=${pipelineRunId} clip=${clip.id} index=${partIndex} duration=${durationSec.toFixed(1)}s`,
  );

  return clip.id;
}

export async function generateDedicatedShort(
  pipelineRunId: string,
  channelId: string,
  config: ChannelConfig,
  options?: GenerateDedicatedShortOptions,
): Promise<DedicatedShortResult> {
  const video = await prisma.video.findFirstOrThrow({ where: { pipelineRunId } });
  const scriptRecord = await prisma.script.findFirstOrThrow({ where: { pipelineRunId } });
  const idea = await prisma.videoIdea.findFirst({
    where: { pipelineRunId, isSelected: true },
  });

  const longVideo = {
    title: scriptRecord.title,
    description: scriptRecord.description,
    hook: idea?.hook ?? scriptRecord.title,
    angle: idea?.angle ?? '',
  };

  const replaceMode = options?.replaceMode ?? 'all';
  const startPartIndex = options?.startPartIndex ?? 0;
  const count =
    options?.count ??
    (config.shortsMode === 'mixed'
      ? resolveMixedShortsCounts(config).dedicatedCount
      : resolveShortsCount(config));

  if (count <= 0) {
    console.info(`[dedicated-short] pipeline=${pipelineRunId} skipped (dedicatedCount=0)`);
    return { clipIds: [], count: 0 };
  }

  if (replaceMode === 'all') {
    await prisma.videoClip.deleteMany({
      where: { videoId: video.id, platform: { in: ['short_source', 'youtube_shorts'] } },
    });
  } else {
    await prisma.videoClip.deleteMany({
      where: {
        videoId: video.id,
        partIndex: { gte: startPartIndex },
        platform: { in: ['short_source', 'youtube_shorts'] },
      },
    });
  }

  const clipIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const partIndex = startPartIndex + i;
    const variationHint = count > 1 ? SHORT_ANGLE_HINTS[i % SHORT_ANGLE_HINTS.length] : undefined;
    const clipId = await buildTeaserClip({
      pipelineRunId,
      channelId,
      config,
      videoId: video.id,
      partIndex,
      variationHint,
      longVideo,
    });
    clipIds.push(clipId);
  }

  console.info(`[dedicated-short] pipeline=${pipelineRunId} generated ${clipIds.length} teaser short(s)`);

  return { clipIds, count: clipIds.length };
}
