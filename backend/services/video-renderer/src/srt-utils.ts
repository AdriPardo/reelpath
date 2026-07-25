import {
  buildSyncedSrtFromScenes,
  serializeSrt,
  type SrtCue,
  type TimedScene,
} from '@autotube/shared';

export type { SrtCue, TimedScene };

function parseSrtTime(ts: string): number {
  const [hms, ms] = ts.trim().split(',');
  const [h, m, s] = hms!.split(':').map(Number);
  return h! * 3600 + m! * 60 + s! + Number(ms) / 1000;
}

export function parseSrt(content: string): SrtCue[] {
  const blocks = content.trim().split(/\n\s*\n/);
  const cues: SrtCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;

    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;

    const [start, end] = timeLine.split('-->').map((s) => s.trim());
    const textStart = lines.indexOf(timeLine) + 1;
    const text = lines.slice(textStart).join(' ').trim();
    if (!text) continue;

    cues.push({
      index: Number(lines[0]) || cues.length + 1,
      startSec: parseSrtTime(start!),
      endSec: parseSrtTime(end!),
      text,
    });
  }

  return cues;
}

/** Cues intersecting [startSec, startSec + durationSec), times shifted to clip start at 0. */
export function sliceSrtCues(
  cues: SrtCue[],
  startSec: number,
  durationSec: number,
): Array<{ startSec: number; endSec: number; text: string }> {
  const endSec = startSec + durationSec;
  const result: Array<{ startSec: number; endSec: number; text: string }> = [];

  for (const cue of cues) {
    if (cue.endSec <= startSec || cue.startSec >= endSec) continue;

    const clipStart = Math.max(0, cue.startSec - startSec);
    const clipEnd = Math.min(durationSec, cue.endSec - startSec);
    if (clipEnd - clipStart < 0.05) continue;

    result.push({
      startSec: clipStart,
      endSec: clipEnd,
      text: cue.text,
    });
  }

  return result;
}

export {
  buildSyncedSrtFromScenes,
  buildPhraseCuesForScene,
  splitIntoPhrases,
  serializeSrt,
  formatSrtTime,
} from '@autotube/shared';
