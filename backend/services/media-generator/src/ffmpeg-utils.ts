import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runFfmpeg } from '@autotube/shared/ffmpeg-runner';

const execFileAsync = promisify(execFile);

export async function getAudioDuration(filePath: string): Promise<number> {
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
    return Number.isFinite(duration) && duration > 0 ? duration : 4;
  } catch {
    return 4;
  }
}

/**
 * Detecta audio casi silencioso (p.ej. fallback anullsrc).
 * mean_volume ≤ -50 dB → regenerar TTS en vez de reutilizar el mudo.
 */
export async function isNearSilentAudio(filePath: string): Promise<boolean> {
  try {
    const { stderr } = await execFileAsync(
      'ffmpeg',
      ['-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'],
      { maxBuffer: 2 * 1024 * 1024 },
    );
    const match = /mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i.exec(stderr);
    if (!match) return false;
    const meanDb = parseFloat(match[1]!);
    return Number.isFinite(meanDb) && meanDb <= -50;
  } catch (err) {
    // ffmpeg volumedetect escribe en stderr y a menudo sale con código ≠ 0.
    const stderr =
      err && typeof err === 'object' && 'stderr' in err
        ? String((err as { stderr?: unknown }).stderr ?? '')
        : '';
    const match = /mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i.exec(stderr);
    if (!match) return false;
    const meanDb = parseFloat(match[1]!);
    return Number.isFinite(meanDb) && meanDb <= -50;
  }
}

export function escapeFfmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
}

/** Normalize TTS loudness and encode high-quality mono MP3 for Shorts. */
export async function postProcessTtsAudio(inputPath: string, outPath: string): Promise<void> {
  await runFfmpeg([
    '-i',
    inputPath,
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ar',
    '44100',
    '-ac',
    '1',
    '-c:a',
    'libmp3lame',
    '-q:a',
    '2',
    '-y',
    outPath,
  ]);
}
