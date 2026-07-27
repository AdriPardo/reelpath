import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface AssertValidVideoFileOptions {
  expectedDurationSec?: number;
  toleranceSec?: number;
  unlinkOnFailure?: boolean;
}

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const duration = parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  } catch {
    return 0;
  }
}

export async function getAudioDuration(filePath: string): Promise<number> {
  const duration = await probeDuration(filePath);
  return duration > 0 ? duration : 4;
}

export async function getVideoDuration(filePath: string): Promise<number> {
  return probeDuration(filePath);
}

export async function assertValidVideoFile(
  filePath: string,
  options?: AssertValidVideoFileOptions,
): Promise<number> {
  const duration = await probeDuration(filePath);
  const toleranceSec = options?.toleranceSec ?? 3;

  if (duration <= 0) {
    if (options?.unlinkOnFailure) {
      await fs.unlink(filePath).catch(() => {});
    }
    throw new Error(
      `Invalid or corrupt video file (no playable duration / missing moov atom): ${filePath}`,
    );
  }

  if (options?.expectedDurationSec !== undefined) {
    const delta = Math.abs(duration - options.expectedDurationSec);
    if (delta > toleranceSec) {
      if (options?.unlinkOnFailure) {
        await fs.unlink(filePath).catch(() => {});
      }
      throw new Error(
        `Video duration ${duration.toFixed(2)}s does not match expected ` +
          `${options.expectedDurationSec}s (tolerance ±${toleranceSec}s): ${filePath}`,
      );
    }
  }

  return duration;
}

export function escapeFfmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
}

export {
  buildLanczosScaleCrop,
  buildMotionScaleCrop,
  ffmpegH264EncodeArgs,
  getFfmpegThreads,
  getFfmpegConcurrency,
  isFfmpegFilmGrainEnabled,
  runFfmpeg,
  FFMPEG_AUDIO_BITRATE,
  FFMPEG_VIDEO_BUFSIZE,
  FFMPEG_VIDEO_CRF,
  FFMPEG_VIDEO_MAXRATE,
  FFMPEG_VIDEO_PRESET,
  VIDEO_RESOLUTION_LONG,
  VIDEO_RESOLUTION_SHORT,
} from '@autotube/shared';

/** ffmpeg args to strip container/metadata tags from rendered output. */
export const FFMPEG_STRIP_METADATA_ARGS = [
  '-map_metadata', '-1',
  '-metadata', 'encoder=',
  '-metadata:s:v:0', 'handler_name=',
  '-metadata:s:a:0', 'handler_name=',
] as const;
