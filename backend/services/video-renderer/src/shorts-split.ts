import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { getStoragePath, loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { applyClipOverlay } from './clip-overlay.js';
import { burnSubtitlesIntoClip, loadPipelineSrt, subClipPath } from './clip-subtitles.js';
import { assertValidVideoFile, buildLanczosScaleCrop, ffmpegH264EncodeArgs, getVideoDuration } from './ffmpeg-utils.js';
import { generateVerticalClipThumbnail } from './thumbnail-generator.js';

const execFileAsync = promisify(execFile);

const SPLIT_LOCK_STALE_MS = 2 * 60 * 60 * 1000;

class SplitInProgressError extends Error {
  statusCode = 409;
  constructor() {
    super('Short split already in progress for this pipeline');
    this.name = 'SplitInProgressError';
  }
}

/** True si el proceso con ese PID sigue vivo en esta máquina. */
function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no existe; EPERM = existe pero sin permisos (lo tratamos como vivo).
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function acquireSplitLock(outDir: string): Promise<() => Promise<void>> {
  const lockPath = path.join(outDir, '.split.lock');
  try {
    await fs.writeFile(lockPath, String(process.pid), { flag: 'wx' });
  } catch {
    const [stat, owner] = await Promise.all([
      fs.stat(lockPath).catch(() => null),
      fs.readFile(lockPath, 'utf8').then((c) => Number(c.trim())).catch(() => NaN),
    ]);
    const ownerAlive = Number.isFinite(owner) && isProcessAlive(owner);
    const fresh = stat ? Date.now() - stat.mtimeMs < SPLIT_LOCK_STALE_MS : false;

    // Solo bloquea si el proceso dueño sigue vivo y el lock no está caducado.
    if (ownerAlive && fresh) {
      throw new SplitInProgressError();
    }

    // Lock huérfano (proceso muerto) o caducado: se reclama.
    await fs.unlink(lockPath).catch(() => {});
    await fs.writeFile(lockPath, String(process.pid), { flag: 'wx' });
  }
  return async () => {
    await fs.unlink(lockPath).catch(() => {});
  };
}

async function cleanShortArtifacts(outDir: string): Promise<void> {
  for (const f of await fs.readdir(outDir)) {
    if (/^part-\d{3}.*\.mp4$/.test(f)) {
      await fs.unlink(path.join(outDir, f)).catch(() => {});
    }
  }
  await fs.rm(path.join(outDir, '.subtitle-work'), { recursive: true, force: true }).catch(() => {});
  await fs.rm(path.join(outDir, '.overlay-work'), { recursive: true, force: true }).catch(() => {});
}

/** Evita un último clip ridículamente corto (resto tras segmentos de maxSec). */
function planSegmentDurations(totalSec: number, maxSec: number, minTailSec = 15): number[] {
  if (totalSec <= maxSec + 5) return [totalSec];

  const fullParts = Math.floor(totalSec / maxSec);
  const tail = totalSec - fullParts * maxSec;

  if (tail === 0) return Array.from({ length: fullParts }, () => maxSec);
  if (tail >= minTailSec) return [...Array.from({ length: fullParts }, () => maxSec), tail];

  if (fullParts === 0) return [totalSec];
  return [...Array.from({ length: fullParts - 1 }, () => maxSec), maxSec + tail];
}

/** Selecciona N segmentos distribuidos a lo largo del vídeo (inicio, medio, final…). */
function selectDistributedSegments(
  totalSec: number,
  maxSec: number,
  maxParts: number,
): Array<{ startSec: number; durationSec: number }> {
  const allDurations = planSegmentDurations(totalSec, maxSec);
  if (maxParts >= allDurations.length) {
    let startSec = 0;
    return allDurations.map((durationSec) => {
      const seg = { startSec, durationSec };
      startSec += durationSec;
      return seg;
    });
  }

  const indices: number[] = [];
  for (let i = 0; i < maxParts; i++) {
    const idx =
      maxParts === 1 ? 0 : Math.round((i * (allDurations.length - 1)) / (maxParts - 1));
    indices.push(idx);
  }
  const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);

  let cursor = 0;
  const starts: number[] = [];
  for (const d of allDurations) {
    starts.push(cursor);
    cursor += d;
  }

  return uniqueIndices.map((idx) => ({
    startSec: starts[idx]!,
    durationSec: allDurations[idx]!,
  }));
}

async function extractShortPart(params: {
  inputPath: string;
  outputPath: string;
  startSec: number;
  durationSec: number;
}): Promise<void> {
  const tmpPath = `${params.outputPath}.tmp.mp4`;
  const vf = buildLanczosScaleCrop(1080, 1920);

  try {
    await execFileAsync('ffmpeg', [
      '-ss', String(params.startSec),
      '-i', params.inputPath,
      '-t', String(params.durationSec),
      '-vf', vf,
      ...ffmpegH264EncodeArgs(),
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart',
      '-y', tmpPath,
    ]);

    await assertValidVideoFile(tmpPath, {
      expectedDurationSec: params.durationSec,
      unlinkOnFailure: true,
    });

    await fs.rename(tmpPath, params.outputPath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/** Número de partes de Short que se generarán para un vídeo de `durationSec`. */
export function expectedShortsPartCount(durationSec: number, maxPartSec?: number): number {
  const config = loadConfig();
  const segmentSec = maxPartSec ?? config.SHORTS_CLIP_MAX_SEC;
  return planSegmentDurations(durationSec, segmentSec).length;
}

export interface ShortsSplitResult {
  clipIds: string[];
  partCount: number;
}

export interface ShortsSplitOptions {
  /** Limita cuántas partes se generan (p. ej. 1 highlight en modo mixto). */
  maxParts?: number;
}

/** Split a long horizontal video into vertical Short parts (9:16, max N seconds each). */
export async function splitVideoForShorts(
  videoId: string,
  maxPartSec?: number,
  options?: ShortsSplitOptions,
): Promise<ShortsSplitResult> {
  const config = loadConfig();
  const segmentSec = maxPartSec ?? config.SHORTS_CLIP_MAX_SEC;

  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  await fs.access(video.filePath);

  const duration = await getVideoDuration(video.filePath);
  if (duration <= segmentSec + 5) {
    // Short enough — single vertical reframe clip
    return createSingleShortClip(video, segmentSec);
  }

  const durations = planSegmentDurations(duration, segmentSec);
  const partLimit = options?.maxParts != null
    ? Math.min(options.maxParts, durations.length)
    : durations.length;

  const segments =
    options?.maxParts != null && options.maxParts < durations.length
      ? selectDistributedSegments(duration, segmentSec, partLimit)
      : (() => {
          let startSec = 0;
          return durations.slice(0, partLimit).map((durationSec) => {
            const seg = { startSec, durationSec };
            startSec += durationSec;
            return seg;
          });
        })();

  const effectiveDurations = segments.map((s) => s.durationSec);
  const outDir = getStoragePath('videos', video.pipelineRunId, 'shorts');
  await fs.mkdir(outDir, { recursive: true });
  const releaseLock = await acquireSplitLock(outDir);

  try {
  // Remove old clips for re-runs
  await prisma.videoClip.deleteMany({ where: { videoId: video.id, platform: 'short_source' } });

  await cleanShortArtifacts(outDir);

  const srtCues = await loadPipelineSrt(video.pipelineRunId);

  const clipIds: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const { startSec, durationSec } = segments[i]!;
    const rawPath = path.join(outDir, `part-${String(i).padStart(3, '0')}.raw.mp4`);
    const filePath = rawPath.replace(/\.raw\.mp4$/, '.mp4');

    await extractShortPart({
      inputPath: video.filePath,
      outputPath: rawPath,
      startSec,
      durationSec,
    });
    await assertValidVideoFile(rawPath, { expectedDurationSec: durationSec });

    const subPath = subClipPath(rawPath);
    if (srtCues) {
      await burnSubtitlesIntoClip({
        inputPath: rawPath,
        outputPath: subPath,
        cues: srtCues,
        startSec,
        durationSec,
      });
    } else {
      await fs.copyFile(rawPath, subPath);
    }

    await applyClipOverlay({
      inputPath: subPath,
      outputPath: filePath,
      videoTitle: video.title,
      partIndex: i,
      partCount: effectiveDurations.length,
    });

    const partDuration = await getVideoDuration(filePath);
    const thumbnailPath = path.join(outDir, `part-${String(i).padStart(3, '0')}-thumb.jpg`);
    let savedThumb: string | null = null;
    try {
      await generateVerticalClipThumbnail({
        title: video.title,
        partIndex: i,
        partCount: effectiveDurations.length,
        videoPath: filePath,
        outputPath: thumbnailPath,
      });
      savedThumb = thumbnailPath;
    } catch (err) {
      console.warn(`[shorts/split] Thumbnail part ${i} failed:`, err);
    }

    const clip = await prisma.videoClip.create({
      data: {
        videoId: video.id,
        pipelineRunId: video.pipelineRunId,
        partIndex: i,
        title: `${video.title} — Parte ${i + 1}/${effectiveDurations.length}`,
        filePath,
        thumbnailPath: savedThumb,
        durationSec: partDuration,
        aspectRatio: '9:16',
        platform: 'short_source',
        publishStatus: 'pending',
      },
    });
    clipIds.push(clip.id);
  }

  console.info(
    `[shorts/split] video=${videoId} parts=${effectiveDurations.length} ` +
      `durations=[${effectiveDurations.map((d) => d.toFixed(0)).join(', ')}]s maxSec=${segmentSec}`,
  );
  return { clipIds, partCount: effectiveDurations.length };
  } finally {
    await releaseLock();
  }
}

async function createSingleShortClip(
  video: { id: string; pipelineRunId: string; title: string; filePath: string },
  _segmentSec: number,
): Promise<ShortsSplitResult> {
  const outDir = getStoragePath('videos', video.pipelineRunId, 'shorts');
  await fs.mkdir(outDir, { recursive: true });
  const releaseLock = await acquireSplitLock(outDir);

  try {
  await prisma.videoClip.deleteMany({ where: { videoId: video.id, platform: 'short_source' } });
  await cleanShortArtifacts(outDir);

  const srtCues = await loadPipelineSrt(video.pipelineRunId);

  const rawPath = path.join(outDir, 'part-000.raw.mp4');
  const subPath = subClipPath(rawPath);
  const outPath = path.join(outDir, 'part-000.mp4');
  const vf = buildLanczosScaleCrop(1080, 1920);

  const sourceDuration = await getVideoDuration(video.filePath);

  await execFileAsync('ffmpeg', [
    '-i', video.filePath,
    '-vf', vf,
    ...ffmpegH264EncodeArgs(),
    '-movflags', '+faststart',
    '-y', rawPath,
  ]);

  const duration = await assertValidVideoFile(rawPath, { expectedDurationSec: sourceDuration });
  if (srtCues) {
    await burnSubtitlesIntoClip({
      inputPath: rawPath,
      outputPath: subPath,
      cues: srtCues,
      startSec: 0,
      durationSec: duration,
    });
  } else {
    await fs.copyFile(rawPath, subPath);
  }

  await applyClipOverlay({
    inputPath: subPath,
    outputPath: outPath,
    videoTitle: video.title,
    partIndex: 0,
    partCount: 1,
  });

  const partDuration = await getVideoDuration(outPath);
  const thumbnailPath = path.join(outDir, 'part-000-thumb.jpg');
  let savedThumb: string | null = null;
  try {
    await generateVerticalClipThumbnail({
      title: video.title,
      partIndex: 0,
      partCount: 1,
      videoPath: outPath,
      outputPath: thumbnailPath,
    });
    savedThumb = thumbnailPath;
  } catch (err) {
    console.warn('[shorts/split] Thumbnail single clip failed:', err);
  }

  const clip = await prisma.videoClip.create({
    data: {
      videoId: video.id,
      pipelineRunId: video.pipelineRunId,
      partIndex: 0,
      title: video.title,
      filePath: outPath,
      thumbnailPath: savedThumb,
      durationSec: partDuration,
      aspectRatio: '9:16',
      platform: 'short_source',
      publishStatus: 'pending',
    },
  });

  return { clipIds: [clip.id], partCount: 1 };
  } finally {
    await releaseLock();
  }
}
