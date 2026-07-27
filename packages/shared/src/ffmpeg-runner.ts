import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  getFfmpegConcurrency,
  getFfmpegNice,
  getFfmpegThreads,
} from './video-encoding.js';

const execFileAsync = promisify(execFile);

/** Args globales antes de inputs: capean filtros/zoompan en VPS pequeños. */
export function ffmpegGlobalArgs(): string[] {
  const threads = getFfmpegThreads();
  if (threads <= 0) return [];
  return [
    '-filter_threads',
    String(threads),
    '-filter_complex_threads',
    String(threads),
  ];
}

let activeEncodes = 0;
const waitQueue: Array<() => void> = [];

async function acquireFfmpegSlot(): Promise<void> {
  const limit = Math.max(1, getFfmpegConcurrency());
  if (activeEncodes < limit) {
    activeEncodes += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
  activeEncodes += 1;
}

function releaseFfmpegSlot(): void {
  activeEncodes = Math.max(0, activeEncodes - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/**
 * Ejecuta ffmpeg con tope de concurrencia (`FFMPEG_CONCURRENCY`, default 1)
 * y threads de filtro (`FFMPEG_THREADS`). Opcional `nice` vía `FFMPEG_NICE`.
 */
export async function runFfmpeg(
  args: string[],
  options?: { maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  await acquireFfmpegSlot();
  try {
    const global = ffmpegGlobalArgs();
    const nice = getFfmpegNice();
    const maxBuffer = options?.maxBuffer ?? 32 * 1024 * 1024;
    if (nice != null && nice > 0) {
      return await execFileAsync('nice', ['-n', String(nice), 'ffmpeg', ...global, ...args], {
        maxBuffer,
      });
    }
    return await execFileAsync('ffmpeg', [...global, ...args], { maxBuffer });
  } finally {
    releaseFfmpegSlot();
  }
}
