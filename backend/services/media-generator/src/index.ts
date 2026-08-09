import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath, isAiSceneImagesEnabled, loadEffectiveConfig, PRODUCT_DEFAULTS } from '@autotube/config';
import { prisma } from '@autotube/database';
import type { ChannelConfig, MediaAssetDTO, ScriptVariant } from '@autotube/shared';
import {
  buildPhraseCuesFromWordTimings,
  buildSyncedSrtFromScenes,
  boundariesToWordTimings,
  computeVisualOriginSummary,
  inferMotionPreset,
  RETENTION_PHRASE_MAX_LEN,
  resolveSceneMotionIntensity,
  sceneWantsStock,
  serializeSrt,
  type MotionPreset,
  type SrtCue,
  type VisualOrigin,
  type WordBoundaryLike,
} from '@autotube/shared';
import { getAudioDuration, isNearSilentAudio } from './ffmpeg-utils.js';
import {
  generateSpeech,
  writeSceneSubtitle,
} from './providers/media-providers.js';
import { buildFalI2vMotionPrompt, generateFalImageToVideo } from './providers/fal-i2v.js';
import { pathExists, resolveSceneVisual } from './providers/stock-provider.js';
import { resolveSceneStockQueries } from './stock-terms.js';

export { generateSpeech, writeSceneSubtitle } from './providers/media-providers.js';
export { isNearSilentAudio, getAudioDuration } from './ffmpeg-utils.js';

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
  /** Channel.config.falI2vEnabled — undefined = heredar default plataforma. */
  channelFalI2vEnabled?: boolean | null;
  /** Channel.config.maxFalI2vPerVideo — undefined = heredar default. */
  channelMaxFalI2vPerVideo?: number | null;
  /** Velocidad reproducción stock B-roll (canal). */
  stockPlaybackSpeed?: number;
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
  const falKey = cfg.FAL_KEY?.trim() || cfg.FAL_API_KEY?.trim() || '';
  const falI2vEnabled =
    params.channelFalI2vEnabled === true ||
    params.channelFalI2vEnabled === false
      ? params.channelFalI2vEnabled
      : cfg.FAL_I2V_ENABLED;
  const maxFalI2v =
    typeof params.channelMaxFalI2vPerVideo === 'number' && params.channelMaxFalI2vPerVideo >= 0
      ? Math.min(8, Math.floor(params.channelMaxFalI2vPerVideo))
      : cfg.MAX_FAL_I2V_PER_VIDEO;
  let falI2vUsed = 0;
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
  if (falI2vEnabled && falKey) {
    console.info(
      `[media-generator] fal image→video ON (tope ${maxFalI2v}/vídeo, model=${cfg.FAL_I2V_MODEL})`,
    );
  } else if (falI2vEnabled && !falKey) {
    console.info('[media-generator] fal image→video pedido pero sin FAL_KEY — se omite');
  }

  const assets: MediaAssetDTO[] = [];
  const timedScenes: Array<{
    narration: string;
    durationSec: number;
    wordBoundaries?: WordBoundaryLike[];
  }> = [];
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

    let wordBoundaries: WordBoundaryLike[] | undefined;
    if (!(await pathExists(audioPath)) || (await isNearSilentAudio(audioPath))) {
      if (await pathExists(audioPath)) {
        console.warn(
          `[media-generator] scene=${scene.index} audio casi silencioso — regenerando TTS`,
        );
      }
      const speech = await generateSpeech(scene.narration, audioPath, {
        language: params.language,
        retentionMode,
      });
      wordBoundaries = speech.wordBoundaries;
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
    let stockMeta: Record<string, unknown> | undefined;

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
        playbackSpeed: params.stockPlaybackSpeed,
      });
      visualAssetType = visual.assetType;
      visualPath = visual.path;
      visualOrigin = visual.visualOrigin;
      if (visual.stockAssetId) {
        usedStockSourceIds.add(visual.stockAssetId);
      }
      if (visual.attribution) {
        stockMeta = { ...visual.attribution };
      }
      if (visualOrigin === 'ai') {
        aiImagesUsed += 1;
        console.info(
          `[media-generator] scene=${scene.index} imagen IA (${aiImagesUsed}${maxAiImages > 0 ? `/${maxAiImages}` : ''})`,
        );

        // Optional: animate hero AI stills (opening + next AI scenes) via fal i2v.
        if (
          falI2vEnabled &&
          falKey &&
          maxFalI2v > 0 &&
          falI2vUsed < maxFalI2v &&
          visualAssetType === 'image' &&
          (await pathExists(imagePath))
        ) {
          try {
            const i2vModel =
              cfg.FAL_I2V_MODEL?.trim() || PRODUCT_DEFAULTS.falI2vModel;
            const motionPrompt = buildFalI2vMotionPrompt(scene.visualPrompt, scene.narration);
            console.info(
              `[media-generator] scene=${scene.index} fal i2v start model=${i2vModel} (${falI2vUsed + 1}/${maxFalI2v})`,
            );
            const i2v = await generateFalImageToVideo({
              apiKey: falKey,
              model: i2vModel,
              imagePath,
              outPath: videoPath,
              prompt: motionPrompt,
              durationSec: (cfg.FAL_I2V_DURATION_SEC === '10' ? '10' : '6') as '6' | '10',
            });
            visualAssetType = 'video';
            visualPath = videoPath;
            falI2vUsed += 1;
            stockMeta = {
              ...(stockMeta ?? {}),
              falI2v: true,
              falI2vModel: i2v.model,
              falI2vDurationSec: i2v.durationSec,
            };
            console.info(
              `[media-generator] scene=${scene.index} fal i2v ok (${falI2vUsed}/${maxFalI2v})`,
            );
          } catch (err) {
            console.warn(
              `[media-generator] scene=${scene.index} fal i2v failed — keep still:`,
              err instanceof Error ? err.message : err,
            );
          }
        }
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
      wordBoundaries,
    });
    timedScenes.push({ narration: scene.narration, durationSec, wordBoundaries });

    assets.push(
      {
        sceneIndex: scene.index,
        type: 'audio',
        path: audioPath,
        metadata: {
          durationSec,
          narration: scene.narration,
          wordBoundaryCount: wordBoundaries?.length ?? 0,
        },
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
          ...(stockMeta ?? {}),
        },
      },
      {
        sceneIndex: scene.index,
        type: 'subtitle',
        path: subtitlePath,
        metadata: { durationSec, wordBoundarySync: Boolean(wordBoundaries?.length) },
      },
    );
  }

  const srtPath = path.join(baseDir, 'subtitles.srt');
  const srtCues = buildSyncedSrtFromScenesWithBoundaries(timedScenes, phraseMaxLen);
  await fs.writeFile(srtPath, serializeSrt(srtCues), 'utf-8');
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

function buildSyncedSrtFromScenesWithBoundaries(
  scenes: Array<{
    narration: string;
    durationSec: number;
    wordBoundaries?: WordBoundaryLike[];
  }>,
  maxPhraseLen: number,
): SrtCue[] {
  const cues: SrtCue[] = [];
  let sceneStart = 0;

  for (const scene of scenes) {
    const timings = scene.wordBoundaries?.length
      ? boundariesToWordTimings(scene.wordBoundaries)
      : [];
    const phraseCues =
      timings.length > 0
        ? buildPhraseCuesFromWordTimings(timings, sceneStart, scene.durationSec, maxPhraseLen)
        : buildSyncedSrtFromScenes(
            [{ narration: scene.narration, durationSec: scene.durationSec }],
            maxPhraseLen,
          ).map((c) => ({
            startSec: c.startSec + sceneStart,
            endSec: c.endSec + sceneStart,
            text: c.text,
          }));

    for (const pc of phraseCues) {
      cues.push({
        index: cues.length + 1,
        startSec: pc.startSec,
        endSec: pc.endSec,
        text: pc.text,
      });
    }
    sceneStart += scene.durationSec;
  }

  return cues;
}
