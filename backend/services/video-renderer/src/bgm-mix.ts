import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath } from '@autotube/config';
import { runFfmpeg } from '@autotube/shared/ffmpeg-runner';
import { getVideoDuration } from './ffmpeg-utils.js';

const SUPPORTED_BGM_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.wav',
  '.flac',
  '.ogg',
  '.opus',
]);

export function shouldUseBgm(params: {
  enabled?: boolean | null;
  volume?: number | null;
}): boolean {
  if (!params.enabled) return false;
  const volume = Number(params.volume ?? 0.18);
  return Number.isFinite(volume) && volume > 0;
}

function isSupportedBgm(fileName: string): boolean {
  return SUPPORTED_BGM_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

async function listAudioInDir(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && isSupportedBgm(e.name) && !e.name.startsWith('.'))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

/** Bundled tracks (repo) + user uploads under storage/bgm. */
export async function listBgmFiles(): Promise<string[]> {
  const dirs = [path.resolve('resource/bgm'), getStoragePath('bgm')];
  const files: string[] = [];
  for (const dir of dirs) {
    files.push(...(await listAudioInDir(dir)));
  }
  return files;
}

/**
 * Resolve a BGM path safely (basename only under known dirs).
 * Empty → random pick; missing library → null (skip mix).
 */
export async function resolveBgmFile(bgmFile?: string | null): Promise<string | null> {
  const available = await listBgmFiles();
  if (available.length === 0) {
    console.warn('[bgm] no tracks in resource/bgm or storage/bgm — skip mix');
    return null;
  }

  const requested = bgmFile?.trim();
  if (requested) {
    const base = path.basename(requested);
    const match = available.find((f) => path.basename(f) === base);
    if (match) return match;
    console.warn(`[bgm] file not found: ${base} — using random`);
  }

  return available[Math.floor(Math.random() * available.length)] ?? null;
}

/**
 * Mix looped BGM under voice track. Fail-soft: on error returns original video.
 * Inspired by MoneyPrinterTurbo (volume + loop + fade-out).
 */
export async function mixBgmIntoVideo(params: {
  videoPath: string;
  bgmPath: string;
  volume: number;
  fadeOutSec?: number;
}): Promise<boolean> {
  const volume = Math.min(1, Math.max(0.01, params.volume));
  const fadeOutSec = Math.max(0.5, params.fadeOutSec ?? 3);
  const tmpOut = params.videoPath.replace(/\.mp4$/i, `-bgm-mix-${Date.now()}.mp4`);

  try {
    const durationSec = await getVideoDuration(params.videoPath);
    const fadeStart =
      durationSec > fadeOutSec + 0.5
        ? Number((durationSec - fadeOutSec).toFixed(3))
        : Math.max(0, Number((durationSec * 0.7).toFixed(3)));

    const filter = [
      `[1:a]volume=${volume},aloop=loop=-1:size=2e+09,atrim=0:${Math.max(durationSec, 1).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=out:st=${fadeStart}:d=${fadeOutSec}[bgm]`,
      `[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]`,
    ].join(';');

    await runFfmpeg([
      '-i',
      params.videoPath,
      '-i',
      params.bgmPath,
      '-filter_complex',
      filter,
      '-map',
      '0:v',
      '-map',
      '[aout]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      '-movflags',
      '+faststart',
      '-y',
      tmpOut,
    ]);

    await fs.rename(tmpOut, params.videoPath);
    console.info(
      `[bgm] mixed volume=${volume} fadeOut=${fadeOutSec}s file=${path.basename(params.bgmPath)}`,
    );
    return true;
  } catch (err) {
    console.warn(
      '[bgm] mix failed (keeping original audio):',
      err instanceof Error ? err.message : err,
    );
    await fs.unlink(tmpOut).catch(() => {});
    return false;
  }
}
