import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { getStoragePath, loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { templateRegistry } from '@autotube/template-engine';
import type {
  MediaAssetDTO,
  MotionPreset,
  ScriptVariant,
  TimelineClip,
  TransitionPreset,
  VideoMotionIntensity,
  VideoTemplate,
} from '@autotube/shared';
import {
  buildLanczosScaleCrop,
  getMotionFilterParams,
  isFfmpegFilmGrainEnabled,
  mapTransitionToFfmpeg,
  VIDEO_RESOLUTION_LONG,
  VIDEO_RESOLUTION_SHORT,
} from '@autotube/shared';
import { runFfmpeg } from '@autotube/shared/ffmpeg-runner';
import {
  buildMotionScaleCrop,
  escapeFfmpegPath,
  ffmpegH264EncodeArgs,
  getAudioDuration,
  getVideoDuration,
} from './ffmpeg-utils.js';
import { buildSyncedSrtFromScenes, serializeSrt, type TimedScene } from './srt-utils.js';
import { generateYouTubeThumbnail } from './thumbnail-generator.js';
import { mixBgmIntoVideo, resolveBgmFile, shouldUseBgm } from './bgm-mix.js';

const execFileAsync = promisify(execFile);
const DEFAULT_TRANSITION_SEC = 0.4;

type RenderedClip = {
  path: string;
  durationSec: number;
  transitionToNext?: TransitionPreset;
};

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function renderSceneClip(
  clip: TimelineClip,
  template: VideoTemplate,
  workDir: string,
  retentionMode = false,
): Promise<string> {
  if (clip.videoPath) {
    return renderSceneClipFromVideo(clip, template, workDir, retentionMode);
  }
  return renderSceneClipFromImage(clip, template, workDir, retentionMode);
}

async function renderSceneClipFromImage(
  clip: TimelineClip,
  template: VideoTemplate,
  workDir: string,
  retentionMode = false,
): Promise<string> {
  const outPath = path.join(workDir, `clip-${clip.sceneIndex}.mp4`);
  const { width, height } = template.resolution;
  const fps = template.fps;

  if (!clip.imagePath || !clip.audioPath) {
    throw new Error(`Missing assets for scene ${clip.sceneIndex}`);
  }

  try {
    await fs.access(clip.imagePath);
    await fs.access(clip.audioPath);
  } catch {
    throw new Error(
      `Asset files missing for scene ${clip.sceneIndex}: image=${clip.imagePath} audio=${clip.audioPath}`,
    );
  }

  // Duración real del TTS — zoompan ignora -shortest y alargaba ~2s/escena
  const audioDuration = await getAudioDuration(clip.audioPath);
  const duration = audioDuration > 0 ? audioDuration : clip.durationSec;
  const frameCount = Math.max(1, Math.floor(duration * fps));

  const baseFilter = buildMotionFilter(clip.motionPreset, {
    width,
    height,
    fps,
    frameCount,
    retentionMode,
    motionIntensity: clip.motionIntensity,
    durationSec: duration,
  });

  const withEffects = applyVisualOverlays(baseFilter, template);

  const subFontSize = Math.max(
    24,
    Math.round(template.subtitleStyle.fontSize * (retentionMode ? 0.78 : 0.9)),
  );
  const subtitleAlignment = template.subtitleStyle.position === 'center' ? 5 : 2;
  const subtitleMarginV = template.subtitleStyle.position === 'center' ? 180 : retentionMode ? 86 : 64;
  const isAss = clip.subtitlePath?.toLowerCase().endsWith('.ass');
  const subtitleStyle = isAss
    ? `FontName=Arial,FontSize=${subFontSize},PrimaryColour=&H00FFFFFF,SecondaryColour=&H0000FFFF,OutlineColour=&H00111111,BackColour=&H66000000,BorderStyle=3,Outline=1.8,Shadow=0,Alignment=${subtitleAlignment},MarginV=${subtitleMarginV},Bold=1,Spacing=0.4`
    : `FontName=Arial,FontSize=${subFontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00111111,BackColour=&H66000000,BorderStyle=3,Outline=1.6,Shadow=0,Alignment=${subtitleAlignment},MarginV=${subtitleMarginV},Bold=1,Spacing=0.4`;
  const withSubs =
    clip.subtitlePath
      ? `${withEffects},subtitles='${escapeFfmpegPath(path.resolve(clip.subtitlePath))}':force_style='${subtitleStyle}'`
      : withEffects;

  for (const videoFilter of [withSubs, `${withEffects},format=yuv420p[vout]`]) {
    const filter = videoFilter.endsWith('[vout]') ? videoFilter : `${videoFilter},format=yuv420p[vout]`;
    try {
      await execFfmpegScene(clip, filter, duration, outPath);
      return outPath;
    } catch (err) {
      if (videoFilter === withSubs && clip.subtitlePath) {
        console.warn('[video-renderer] Subtitles filter unavailable, rendering without subs');
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Failed to render scene ${clip.sceneIndex}`);
}

async function renderSceneClipFromVideo(
  clip: TimelineClip,
  template: VideoTemplate,
  workDir: string,
  retentionMode = false,
): Promise<string> {
  const outPath = path.join(workDir, `clip-${clip.sceneIndex}.mp4`);
  const { width, height } = template.resolution;
  const fps = template.fps;

  if (!clip.videoPath || !clip.audioPath) {
    throw new Error(`Missing video assets for scene ${clip.sceneIndex}`);
  }

  try {
    await fs.access(clip.videoPath);
    await fs.access(clip.audioPath);
  } catch {
    throw new Error(
      `Asset files missing for scene ${clip.sceneIndex}: video=${clip.videoPath} audio=${clip.audioPath}`,
    );
  }

  const audioDuration = await getAudioDuration(clip.audioPath);
  const duration = audioDuration > 0 ? audioDuration : clip.durationSec;

  const scaleCrop = buildLanczosScaleCrop(width, height);
  let baseFilter = `[0:v]${scaleCrop},fps=${fps},trim=duration=${duration},setpts=PTS-STARTPTS`;
  baseFilter = applyVisualOverlays(baseFilter, template);

  const subFontSize = Math.max(
    24,
    Math.round(template.subtitleStyle.fontSize * (retentionMode ? 0.78 : 0.9)),
  );
  const subtitleAlignment = template.subtitleStyle.position === 'center' ? 5 : 2;
  const subtitleMarginV = template.subtitleStyle.position === 'center' ? 180 : retentionMode ? 86 : 64;
  const isAss = clip.subtitlePath?.toLowerCase().endsWith('.ass');
  const subtitleStyle = isAss
    ? `FontName=Arial,FontSize=${subFontSize},PrimaryColour=&H00FFFFFF,SecondaryColour=&H0000FFFF,OutlineColour=&H00111111,BackColour=&H66000000,BorderStyle=3,Outline=1.8,Shadow=0,Alignment=${subtitleAlignment},MarginV=${subtitleMarginV},Bold=1,Spacing=0.4`
    : `FontName=Arial,FontSize=${subFontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00111111,BackColour=&H66000000,BorderStyle=3,Outline=1.6,Shadow=0,Alignment=${subtitleAlignment},MarginV=${subtitleMarginV},Bold=1,Spacing=0.4`;
  const withSubs =
    clip.subtitlePath
      ? `${baseFilter},subtitles='${escapeFfmpegPath(path.resolve(clip.subtitlePath))}':force_style='${subtitleStyle}'`
      : baseFilter;

  for (const videoFilter of [withSubs, `${baseFilter},format=yuv420p[vout]`]) {
    const filter = videoFilter.endsWith('[vout]') ? videoFilter : `${videoFilter},format=yuv420p[vout]`;
    try {
      await execFfmpegVideoScene(clip, filter, duration, outPath);
      return outPath;
    } catch (err) {
      if (videoFilter === withSubs && clip.subtitlePath) {
        console.warn('[video-renderer] Subtitles filter unavailable on stock clip, rendering without subs');
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Failed to render stock video scene ${clip.sceneIndex}`);
}

async function execFfmpegVideoScene(
  clip: TimelineClip,
  videoFilter: string,
  duration: number,
  outPath: string,
): Promise<void> {
  const args = [
    '-stream_loop', '-1', '-i', clip.videoPath!,
    '-i', clip.audioPath!,
    '-filter_complex', videoFilter,
    '-map', '[vout]', '-map', '1:a',
    ...ffmpegH264EncodeArgs(),
    '-af', `afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(0, duration - 0.2)}:d=0.2`,
    '-t', String(duration),
    '-y', outPath,
  ];
  await runFfmpeg(args);
}

async function execFfmpegScene(
  clip: TimelineClip,
  videoFilter: string,
  duration: number,
  outPath: string,
): Promise<void> {
  const args = [
    '-loop', '1', '-i', clip.imagePath!,
    '-i', clip.audioPath!,
    '-filter_complex', videoFilter,
    '-map', '[vout]', '-map', '1:a',
    ...ffmpegH264EncodeArgs(),
    '-af', `afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(0, duration - 0.2)}:d=0.2`,
    '-t', String(duration),
    '-y', outPath,
  ];
  await runFfmpeg(args);
}

function applyVisualOverlays(baseFilter: string, template: VideoTemplate): string {
  let filter = baseFilter;
  if (template.vignette) {
    filter = `${filter},vignette=angle=PI/4:mode=forward`;
  }
  // noise/filmGrain es muy caro en CPU; off salvo FFMPEG_ENABLE_FILM_GRAIN=true
  if (template.filmGrain && isFfmpegFilmGrainEnabled()) {
    filter = `${filter},noise=alls=6:allf=t+u`;
  }
  return filter;
}

function buildMotionFilter(
  motionPreset: MotionPreset | undefined,
  params: {
    width: number;
    height: number;
    fps: number;
    frameCount: number;
    retentionMode: boolean;
    motionIntensity?: VideoMotionIntensity;
    durationSec: number;
  },
): string {
  const { width, height, fps, frameCount, retentionMode, motionIntensity, durationSec } = params;
  const intensity = motionIntensity ?? (retentionMode ? 'dynamic' : 'normal');
  const { zoomRate, maxZoom, travelZoom, startZoom } = getMotionFilterParams(
    intensity,
    retentionMode,
    durationSec,
  );
  const progressDen = Math.max(1, frameCount - 1);
  const progress = `on/${progressDen}`;
  const preset = motionPreset ?? 'push-in';

  let z = `'min(zoom+${zoomRate},${maxZoom})'`;
  let x = `'iw/2-(iw/zoom/2)'`;
  let y = `'ih/2-(ih/zoom/2)'`;

  if (preset === 'pull-out') {
    z = `'if(eq(on,1),${startZoom},max(zoom-${zoomRate},1.0))'`;
  } else if (preset === 'pan-left') {
    z = `'${travelZoom}'`;
    x = `'(iw-iw/zoom)*(1-${progress})'`;
  } else if (preset === 'pan-right') {
    z = `'${travelZoom}'`;
    x = `'(iw-iw/zoom)*${progress}'`;
  } else if (preset === 'drift-up') {
    z = `'${travelZoom}'`;
    y = `'(ih-ih/zoom)*(1-${progress})'`;
  } else if (preset === 'drift-down') {
    z = `'${travelZoom}'`;
    y = `'(ih-ih/zoom)*${progress}'`;
  }

  const scaleCrop = buildMotionScaleCrop(width, height, maxZoom);

  return (
    `[0:v]${scaleCrop},` +
    `zoompan=z=${z}:x=${x}:y=${y}:d=${frameCount}:s=${width}x${height}:fps=${fps}`
  );
}

function mapTransitionPreset(preset: TransitionPreset | undefined): string {
  return mapTransitionToFfmpeg(preset);
}

async function concatClips(
  renderedClips: RenderedClip[],
  outputPath: string,
  template: VideoTemplate,
): Promise<void> {
  if (renderedClips.length === 1) {
    await fs.copyFile(renderedClips[0].path, outputPath);
    return;
  }

  if (template.transitions === 'cut') {
    await concatClipsWithCuts(renderedClips, outputPath, template);
    return;
  }

  try {
    await concatClipsWithTransitions(renderedClips, outputPath, template);
  } catch (err) {
    console.warn('[video-renderer] Transition concat failed, falling back to straight concat:', err);
    await concatClipsWithCuts(renderedClips, outputPath, template);
  }
}

async function concatClipsWithCuts(
  renderedClips: RenderedClip[],
  outputPath: string,
  template: VideoTemplate,
): Promise<void> {
  const listPath = outputPath.replace('.mp4', '-concat.txt');
  const content = renderedClips.map((c) => `file '${c.path.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, content);

  await runFfmpeg([
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c', 'copy',
    '-movflags', '+faststart', '-y', outputPath,
  ]);
}

async function concatClipsWithTransitions(
  renderedClips: RenderedClip[],
  outputPath: string,
  template: VideoTemplate,
): Promise<void> {
  const filterParts: string[] = [];
  const args = renderedClips.flatMap((clip) => ['-i', clip.path]);
  let currentVideo = '[0:v]';
  let currentAudio = '[0:a]';
  let elapsedSec = renderedClips[0]?.durationSec ?? 0;

  for (let index = 1; index < renderedClips.length; index += 1) {
    const previous = renderedClips[index - 1]!;
    const current = renderedClips[index]!;
    const transitionSec = Number(
      Math.max(
        0.2,
        Math.min(
          DEFAULT_TRANSITION_SEC,
          Math.max(0.2, previous.durationSec / 4),
          Math.max(0.2, current.durationSec / 4),
        ),
      ).toFixed(3),
    );
    const offsetSec = Number(Math.max(0, elapsedSec - transitionSec).toFixed(3));
    const videoLabel = `[v${index}]`;
    const audioLabel = `[a${index}]`;

    filterParts.push(
      `${currentVideo}[${index}:v]xfade=transition=${mapTransitionPreset(previous.transitionToNext)}:duration=${transitionSec}:offset=${offsetSec}${videoLabel}`,
    );
    filterParts.push(
      `${currentAudio}[${index}:a]acrossfade=d=${transitionSec}:c1=tri:c2=tri${audioLabel}`,
    );

    currentVideo = videoLabel;
    currentAudio = audioLabel;
    elapsedSec += current.durationSec - transitionSec;
  }

  filterParts.push(`${currentVideo}format=yuv420p[vout]`);

  await runFfmpeg([
    ...args,
    '-filter_complex', filterParts.join(';'),
    '-map', '[vout]',
    '-map', currentAudio,
    ...ffmpegH264EncodeArgs(),
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ]);
}

async function generateThumbnail(
  timeline: TimelineClip[],
  videoPath: string,
  title: string,
  template: VideoTemplate,
  options?: {
    overlayText?: string | null;
    highlightWord?: string | null;
    backgroundImagePath?: string | null;
    brandLabel?: string | null;
  },
): Promise<string> {
  const thumbnailPath = videoPath.replace(/\.mp4$/, '-thumbnail.jpg');
  const firstImage =
    options?.backgroundImagePath ||
    timeline.find((c) => c.imagePath)?.imagePath ||
    timeline.find((c) => c.videoPath)?.videoPath;

  await generateYouTubeThumbnail({
    title,
    overlayText: options?.overlayText,
    highlightWord: options?.highlightWord,
    backgroundImagePath: firstImage,
    videoPath,
    outputPath: thumbnailPath,
    width: template.resolution.width,
    height: template.resolution.height,
    brandLabel: options?.brandLabel,
  });

  return thumbnailPath;
}

async function createFallbackVideo(outputPath: string, durationSec: number): Promise<void> {
  await runFfmpeg([
    '-f', 'lavfi',
    '-i', `color=c=0x1a1a2e:s=1080x1920:d=${durationSec}`,
    '-f', 'lavfi',
    '-i', `anullsrc=r=44100:cl=mono:d=${durationSec}`,
    ...ffmpegH264EncodeArgs(),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y', outputPath,
  ]);
}

export async function renderVideo(params: {
  pipelineRunId: string;
  channelId: string;
  templateId: string;
  script: ScriptVariant;
  assets: MediaAssetDTO[];
  title: string;
  description: string;
  tags: string[];
  format: string;
  aspectRatio: string;
  reviewRequired: boolean;
  retentionMode?: boolean;
  videoMotionIntensity?: VideoMotionIntensity;
  /** Enable background music mix after concat. */
  bgmEnabled?: boolean;
  /** BGM volume 0–1 (default 0.18). */
  bgmVolume?: number;
  /** Basename under resource/bgm or storage/bgm; empty = random. */
  bgmFile?: string;
  /** Subfolder under videos/<pipelineRunId>/ (e.g. "short"). */
  outputSubdir?: string;
  /** When false, skip Video DB record (auxiliary renders like dedicated shorts). */
  persistAsVideo?: boolean;
  /** Pipeline subfolder for SRT when outputSubdir is set. */
  mediaSubdir?: string;
  /**
   * Burn scene subtitles into the rendered video.
   * Default: true for shorts / 9:16, false for long / 16:9.
   * Shorts split still burns from subtitles.srt after cutting the long.
   */
  burnSubtitles?: boolean;
  /** Channel niche — thumbnail CTR copy. */
  niche?: string | null;
  brandName?: string | null;
  language?: string;
  /** Idea angle for thumbnail overlay text. */
  angle?: string | null;
}): Promise<{
  videoId?: string;
  filePath: string;
  durationSec: number;
  thumbnailPath?: string | null;
}> {
  const persistAsVideo = params.persistAsVideo !== false;
  const burnSubtitles =
    params.burnSubtitles ??
    (params.format === 'shorts' || params.aspectRatio === '9:16');
  const template = await templateRegistry.getTemplate(params.templateId);
  const retentionMode = params.retentionMode ?? false;
  const forceCut =
    process.env.FFMPEG_FORCE_CUT_TRANSITIONS === 'true' ||
    (process.env.FFMPEG_FORCE_CUT_TRANSITIONS !== 'false' &&
      process.env.NODE_ENV === 'production');
  let renderTemplate: VideoTemplate = {
    ...template,
    // En prod (o FFMPEG_FORCE_CUT_TRANSITIONS=true): cortes = concat -c copy (casi 0 CPU).
    // En dev: xfade salvo plantilla cut.
    transitions: forceCut
      ? 'cut'
      : template.transitions === 'cut'
        ? 'fade'
        : template.transitions,
  };

  if (params.aspectRatio === '9:16') {
    renderTemplate = {
      ...renderTemplate,
      aspectRatio: '9:16',
      resolution: { ...VIDEO_RESOLUTION_SHORT },
    };
  } else if (params.aspectRatio === '16:9') {
    renderTemplate = {
      ...renderTemplate,
      aspectRatio: '16:9',
      resolution: { ...VIDEO_RESOLUTION_LONG },
    };
  }

  const timelineRaw = templateRegistry.buildTimeline(params.script, params.assets, {
    videoMotionIntensity: params.videoMotionIntensity,
    retentionMode,
  });
  const timeline = burnSubtitles
    ? timelineRaw
    : timelineRaw.map((clip) => ({ ...clip, subtitlePath: undefined }));
  if (!burnSubtitles) {
    console.info(
      `[video-renderer] subtítulos quemados OFF (format=${params.format} aspect=${params.aspectRatio})`,
    );
  }
  const totalDuration = timeline.reduce((s, c) => s + c.durationSec, 0);

  const outDir = params.outputSubdir
    ? getStoragePath('videos', params.pipelineRunId, params.outputSubdir)
    : getStoragePath('videos', params.pipelineRunId);
  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, 'final.mp4');

  const hasFfmpeg = await ffmpegAvailable();
  if (!hasFfmpeg) {
    throw new Error('FFmpeg is required for video rendering');
  }

  const workDir = path.join(outDir, 'work');
  await fs.mkdir(workDir, { recursive: true });

  const renderedClips: RenderedClip[] = [];
  const timedScenes: TimedScene[] = [];
  try {
    for (const clip of timeline) {
      const hasVisual = clip.videoPath || clip.imagePath;
      if (hasVisual && clip.audioPath) {
        const clipPath = await renderSceneClip(clip, renderTemplate, workDir, retentionMode);
        const actualDur = await getAudioDuration(clip.audioPath);
        const durationSec = actualDur > 0 ? actualDur : clip.durationSec;
        renderedClips.push({
          path: clipPath,
          durationSec,
          transitionToNext: clip.transitionToNext,
        });
        timedScenes.push({
          narration: clip.narration ?? '',
          durationSec,
        });
      }
    }

    if (renderedClips.length > 0) {
      await concatClips(renderedClips, outputPath, renderTemplate);
    } else {
      await createFallbackVideo(outputPath, totalDuration || 10);
    }

    if (
      shouldUseBgm({ enabled: params.bgmEnabled, volume: params.bgmVolume }) &&
      renderedClips.length > 0
    ) {
      const bgmPath = await resolveBgmFile(params.bgmFile);
      if (bgmPath) {
        await mixBgmIntoVideo({
          videoPath: outputPath,
          bgmPath,
          volume: params.bgmVolume ?? 0.18,
        });
      }
    }

    if (timedScenes.length > 0) {
      const srtPath = params.mediaSubdir
        ? getStoragePath('pipelines', params.pipelineRunId, params.mediaSubdir, 'subtitles.srt')
        : getStoragePath('pipelines', params.pipelineRunId, 'subtitles.srt');
      const synced = buildSyncedSrtFromScenes(timedScenes);
      await fs.writeFile(srtPath, serializeSrt(synced), 'utf-8');
      console.info(`[video-renderer] SRT sincronizado: ${synced.length} cues`);
    }
  } catch (err) {
    loadConfig();
    console.error('[video-renderer] Render failed, using fallback:', err);
    await createFallbackVideo(outputPath, totalDuration || 10);
  }

  const probedDuration = await getVideoDuration(outputPath);
  const finalDuration = probedDuration > 0 ? probedDuration : totalDuration;

  console.info(
    `[video-renderer] ${renderedClips.length} clips, ` +
      `estimated=${Math.round(totalDuration)}s actual=${Math.round(finalDuration)}s`,
  );

  let thumbnailPath: string | null = null;
  try {
    const { resolveThumbnailOverlayText } = await import('./thumbnail-copy.js');
    const overlay = await resolveThumbnailOverlayText({
      title: params.title,
      hook: params.script.hook,
      angle: params.angle,
      niche: params.niche,
      format: params.format === 'shorts' ? 'shorts' : 'long',
      language: params.language ?? 'es',
    });
    console.info(
      `[video-renderer] Thumbnail overlay (${overlay.source}): "${overlay.overlayText}"` +
        (overlay.highlightWord ? ` hl="${overlay.highlightWord}"` : ''),
    );

    const thumbBgAsset = params.assets.find(
      (a) =>
        a.type === 'image' &&
        (a.metadata as { role?: string } | undefined)?.role === 'thumbnail-bg',
    );
    const brandLabel = params.brandName?.trim() || null;

    if (params.aspectRatio === '9:16') {
      const { generateVerticalClipThumbnail } = await import('./thumbnail-generator.js');
      thumbnailPath = outputPath.replace(/\.mp4$/, '-thumbnail.jpg');
      await generateVerticalClipThumbnail({
        title: params.title.replace(/ #Shorts$/i, ''),
        overlayText: overlay.overlayText,
        highlightWord: overlay.highlightWord,
        partIndex: 0,
        partCount: 1,
        videoPath: outputPath,
        outputPath: thumbnailPath,
        showPartLabel: false,
        backgroundImagePath: thumbBgAsset?.path,
      });
    } else {
      thumbnailPath = await generateThumbnail(timeline, outputPath, params.title, renderTemplate, {
        overlayText: overlay.overlayText,
        highlightWord: overlay.highlightWord,
        backgroundImagePath: thumbBgAsset?.path,
        brandLabel,
      });
    }
    console.info(`[video-renderer] Thumbnail: ${thumbnailPath}`);
  } catch (err) {
    console.warn('[video-renderer] Thumbnail generation failed:', err);
  }

  if (!persistAsVideo) {
    return { filePath: outputPath, durationSec: finalDuration, thumbnailPath };
  }

  const videoData = {
    title: params.title,
    description: params.description,
    tags: params.tags,
    filePath: outputPath,
    thumbnailPath,
    format: params.format,
    aspectRatio: params.aspectRatio,
    durationSec: finalDuration,
    reviewStatus: params.reviewRequired ? 'pending' : 'approved',
  };

  // Repair/re-render: actualizar el Video existente del pipeline (evitar duplicados).
  const existing = await prisma.video.findFirst({
    where: { pipelineRunId: params.pipelineRunId },
    orderBy: { createdAt: 'asc' },
  });

  const video = existing
    ? await prisma.video.update({ where: { id: existing.id }, data: videoData })
    : await prisma.video.create({
        data: {
          pipelineRunId: params.pipelineRunId,
          channelId: params.channelId,
          ...videoData,
        },
      });

  if (existing) {
    await prisma.video.deleteMany({
      where: {
        pipelineRunId: params.pipelineRunId,
        id: { not: existing.id },
        filePath: '',
      },
    });
  }

  return { videoId: video.id, filePath: outputPath, durationSec: finalDuration };
}

export { splitVideoForShorts, expectedShortsPartCount } from './shorts-split.js';
export type { ShortsSplitResult } from './shorts-split.js';
export { applyClipOverlay, rawClipPath } from './clip-overlay.js';
export { burnSubtitlesIntoClip, loadPipelineSrt, subClipPath } from './clip-subtitles.js';
export { generateYouTubeThumbnail, generateVerticalClipThumbnail } from './thumbnail-generator.js';
export { resolveThumbnailOverlayText } from './thumbnail-copy.js';
export { getVideoDuration } from './ffmpeg-utils.js';
export { listBgmFiles, mixBgmIntoVideo, resolveBgmFile, shouldUseBgm } from './bgm-mix.js';
