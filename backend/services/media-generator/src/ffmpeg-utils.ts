import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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

export function escapeFfmpegPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
}

/** Normalize TTS loudness and encode high-quality mono MP3 for Shorts. */
export async function postProcessTtsAudio(inputPath: string, outPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
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
