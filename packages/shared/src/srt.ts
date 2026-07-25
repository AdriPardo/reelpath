export interface SrtCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface TimedScene {
  narration: string;
  durationSec: number;
}

export function splitIntoPhrases(text: string, maxLen = 42): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences = trimmed.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [trimmed];
  const phrases: string[] = [];

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length <= maxLen) {
      phrases.push(s);
      continue;
    }

    const parts = s.split(/,\s*/);
    let buf = '';
    for (const part of parts) {
      const next = buf ? `${buf}, ${part}` : part;
      if (next.length > maxLen && buf) {
        phrases.push(buf.trim());
        buf = part;
      } else {
        buf = next;
      }
    }
    if (buf.trim()) phrases.push(buf.trim());
  }

  return phrases.length > 0 ? phrases : [trimmed.slice(0, maxLen)];
}

export function buildPhraseCuesForScene(
  narration: string,
  sceneStartSec: number,
  durationSec: number,
  maxPhraseLen = 42,
): Array<{ startSec: number; endSec: number; text: string }> {
  const phrases = splitIntoPhrases(narration, maxPhraseLen);
  if (phrases.length === 0 || durationSec <= 0) return [];

  const totalChars = phrases.reduce((sum, p) => sum + p.length, 0) || 1;
  const sceneEnd = sceneStartSec + durationSec;
  const minCueSec = 0.6;
  const cues: Array<{ startSec: number; endSec: number; text: string }> = [];
  let offset = sceneStartSec;

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i]!;
    const isLast = i === phrases.length - 1;
    const rawDur = (phrase.length / totalChars) * durationSec;
    const dur = isLast ? sceneEnd - offset : Math.max(minCueSec, rawDur);
    const end = isLast ? sceneEnd : Math.min(offset + dur, sceneEnd);
    if (end - offset < 0.15) continue;

    cues.push({ startSec: offset, endSec: end, text: phrase });
    offset = end;
  }

  if (cues.length > 0) {
    cues[cues.length - 1]!.endSec = sceneEnd;
  }

  return cues;
}

export function buildSyncedSrtFromScenes(scenes: TimedScene[], maxPhraseLen = 42): SrtCue[] {
  const cues: SrtCue[] = [];
  let sceneStart = 0;

  for (const scene of scenes) {
    const phraseCues = buildPhraseCuesForScene(
      scene.narration,
      sceneStart,
      scene.durationSec,
      maxPhraseLen,
    );
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

export function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function serializeSrt(cues: SrtCue[]): string {
  return cues
    .map(
      (cue) =>
        `${cue.index}\n${formatSrtTime(cue.startSec)} --> ${formatSrtTime(cue.endSec)}\n${cue.text}\n`,
    )
    .join('\n');
}
