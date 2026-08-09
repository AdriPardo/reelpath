import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath, isAiSceneImagesEnabled, loadEffectiveConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import type { ChannelConfig, MediaAssetDTO, ScriptVariant } from '@autotube/shared';
import {
  buildSyncedSrtFromScenes,
  computeVisualOriginSummary,
  inferMotionPreset,
  RETENTION_PHRASE_MAX_LEN,
  resolveSceneMotionIntensity,
  sceneWantsStock,
  serializeSrt,
  type MotionPreset,
  type VisualOrigin,
} from '@autotube/shared';
import { getAudioDuration, isNearSilentAudio } from './ffmpeg-utils.js';
import {
  generateSpeech,
  writeSceneSubtitle,
} from './providers/media-providers.js';
import { pathExists, resolveSceneVisual } from './providers/stock-provider.js';
import { resolveSceneStockQueries } from './stock-terms.js';

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function generateMedia(params: {
  pipelineRunId: string;
  script: ScriptVariant;
  language?: string;
  aspectRatio?: '9:16' | '16:9';
  retentionMode?: boolean;
  videoMotionIntensity?: 'subtle' | 'normal' | 'dynamic';
  visualSourceMode?: ChannelConfig['visualSourceMode'];
  /** Plan de la organización — solo fuerza IA si FORCE_AI_IMAGES_ON_PAID=true. */
  orgPlan?: string | null;
  /** Channel.config.generateAiImages — undefined = heredar org/env. */
  channelGenerateAiImages?: boolean | null;
  /** Subfolder under pipelines/<id>/ (e.g. "short"). */
  subdir?: string;
  /** When false, skip MediaAsset DB writes (for auxiliary renders like dedicated shorts). */
  persist?: boolean;
}): Promise<MediaAssetDTO[]> {
  const aspectRatio = params.aspectRatio ?? '16:9';
  const retentionMode = params.retentionMode ?? false;
  const persist = params.persist !== false;
  const visualSourceMode = params.visualSourceMode ?? 'mixed';
  const cfg = loadEffectiveConfig();
  const aiImagesBase = isAiSceneImagesEnabled(params.orgPlan, {
    channelGenerateAiImages: params.channelGenerateAiImages,
  });
  const maxAiImages = cfg.MAX_AI_IMAGES_PER_VIDEO;
  let aiImagesUsed = 0;
  const forceAiImages = cfg.FORCE_AI_IMAGES_ON_PAID && aiImagesBase && !cfg.GENERATE_DALLE_IMAGES;
  const phraseMaxLen = retentionMode ? RETENTION_PHRASE_MAX_LEN : 42;
  const baseDir = params.subdir
    ? getStoragePath('pipelines', params.pipelineRunId, params.subdir)
    : getStoragePath('pipelines', params.pipelineRunId);
  await ensureDir(baseDir);

  if (aiImagesBase) {
    console.info(
      `[media-generator] imágenes IA activas` +
        (maxAiImages > 0 ? ` (tope ${maxAiImages}/vídeo)` : ' (sin tope)') +
        (cfg.GENERATE_DALLE_IMAGES ? ' vía GENERATE_DALLE_IMAGES' : ' vía FORCE_AI_IMAGES_ON_PAID'),
    );
  }

  const assets: MediaAssetDTO[] = [];
  const timedScenes: Array<{ narration: string; durationSec: number }> = [];
  let previousPreset: MotionPreset | undefined;

  const stockQueries = await resolveSceneStockQueries(params.script.scenes);
  const usedStockSourceIds = new Set<string>();

  for (const scene of params.script.scenes) {
    // Escenas en serie a propósito: TTS + normalización stock + FFmpeg no se paralelizan
    // (evita picos CPU/RAM en VPS). Subir paralelismo requeriría cola + FFMPEG_CONCURRENCY.
    const durationHint =
      Number(scene.durationSec) ||
      timedScenes[timedScenes.length - 1]?.durationSec ||
      5;

    const motionPreset = inferMotionPreset({
      sceneIndex: scene.index,
      narration: scene.narration,
      visualPrompt: scene.visualPrompt,
      previousPreset,
      durationSec: durationHint,
      videoMotionIntensity: params.videoMotionIntensity,
      retentionMode,
    });
    previousPreset = motionPreset;

    const motionIntensity = resolveSceneMotionIntensity({
      sceneIndex: scene.index,
      durationSec: durationHint,
      channelIntensity: params.videoMotionIntensity,
      retentionMode,
    });

    const audioPath = path.join(baseDir, `scene-${scene.index}-audio.mp3`);
    const imagePath = path.join(baseDir, `scene-${scene.index}-image.png`);
    const videoPath = path.join(baseDir, `scene-${scene.index}-video.mp4`);
    const subtitlePath = path.join(baseDir, `scene-${scene.index}.ass`);

    if (!(await pathExists(audioPath)) || (await isNearSilentAudio(audioPath))) {
      if (await pathExists(audioPath)) {
        console.warn(
          `[media-generator] scene=${scene.index} audio casi silencioso — regenerando TTS`,
        );
      }
      await generateSpeech(scene.narration, audioPath, {
        language: params.language,
        retentionMode,
      });
    }
    const durationSec = await getAudioDuration(audioPath);

    const wantsStock = sceneWantsStock(
      scene.index,
      visualSourceMode,
      scene.preferredVisualSource,
    );
    const visualExists =
      (await pathExists(videoPath)) || (await pathExists(imagePath));

    let visualAssetType: 'image' | 'video' = 'image';
    let visualPath = imagePath;
    let visualOrigin: VisualOrigin = 'placeholder';

    const allowAiImages =
      aiImagesBase && (maxAiImages <= 0 || aiImagesUsed < maxAiImages);

    if (!visualExists) {
      const visual = await resolveSceneVisual({
        visualPrompt: scene.visualPrompt,
        narration: scene.narration,
        imageOutPath: imagePath,
        videoOutPath: videoPath,
        sceneIndex: scene.index,
        aspectRatio,
        preferredSource: wantsStock ? 'stock' : 'image',
        forceAiImages,
        allowAiImages,
        stockQuery: stockQueries.get(scene.index) ?? scene.stockQuery,
        usedSourceIds: usedStockSourceIds,
      });
      visualAssetType = visual.assetType;
      visualPath = visual.path;
      visualOrigin = visual.visualOrigin;
      if (visual.stockAssetId) {
        usedStockSourceIds.add(visual.stockAssetId);
      }
      if (visualOrigin === 'ai') {
        aiImagesUsed += 1;
        console.info(
          `[media-generator] scene=${scene.index} imagen IA (${aiImagesUsed}${maxAiImages > 0 ? `/${maxAiImages}` : ''})`,
        );
      } else if (visualOrigin === 'stock') {
        console.info(
          `[media-generator] scene=${scene.index} stock ${visual.assetType} (${visual.path})`,
        );
      } else {
        console.info(`[media-generator] scene=${scene.index} placeholder procedural`);
      }
    } else if (await pathExists(videoPath)) {
      visualAssetType = 'video';
      visualPath = videoPath;
      visualOrigin = wantsStock ? 'stock' : 'ai';
    } else {
      visualOrigin = wantsStock ? 'stock' : 'ai';
    }

    await writeSceneSubtitle(subtitlePath, scene.narration, durationSec, {
      retentionMode,
      templatePosition: 'bottom',
    });
    timedScenes.push({ narration: scene.narration, durationSec });

    assets.push(
      {
        sceneIndex: scene.index,
        type: 'audio',
        path: audioPath,
        metadata: { durationSec, narration: scene.narration },
      },
      {
        sceneIndex: scene.index,
        type: visualAssetType,
        path: visualPath,
        metadata: {
          visualPrompt: scene.visualPrompt,
          stockQuery: stockQueries.get(scene.index),
          durationSec,
          motionPreset,
          motionIntensity,
          preferredVisualSource: wantsStock ? 'stock' : 'image',
          visualOrigin,
        },
      },
      {
        sceneIndex: scene.index,
        type: 'subtitle',
        path: subtitlePath,
        metadata: { durationSec },
      },
    );
  }

  const srtPath = path.join(baseDir, 'subtitles.srt');
  await fs.writeFile(
    srtPath,
    serializeSrt(buildSyncedSrtFromScenes(timedScenes, phraseMaxLen)),
    'utf-8',
  );
  assets.push({ sceneIndex: -1, type: 'subtitle', path: srtPath });

  if (persist) {
    await prisma.mediaAsset.deleteMany({ where: { pipelineRunId: params.pipelineRunId } });
    await prisma.mediaAsset.createMany({
      data: assets.map((a) => ({
        pipelineRunId: params.pipelineRunId,
        sceneIndex: a.sceneIndex,
        type: a.type,
        path: a.path,
        metadata: (a.metadata ?? {}) as object,
      })),
    });
  }

  const summary = computeVisualOriginSummary(
    assets.filter((a) => a.type === 'image' || a.type === 'video'),
  );
  if (summary) {
    console.info(
      `[media-generator] resumen visuales run=${params.pipelineRunId}: ` +
        `stock=${summary.stock} ia=${summary.ai} placeholder=${summary.placeholder} ` +
        `(modo=${visualSourceMode}${aiImagesBase ? ', IA on' : ', IA off'})`,
    );
  }

  return assets;
}
