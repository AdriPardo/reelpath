/**
 * Edge/Azure WordBoundary offsets are 100-nanosecond ticks (10_000_000 = 1s).
 */

export interface WordTiming {
  text: string;
  startSec: number;
  endSec: number;
}

export interface WordBoundaryLike {
  text?: string;
  offset: number;
  duration: number;
}

const TICKS_PER_SEC = 10_000_000;

export function wordBoundaryToTiming(b: WordBoundaryLike): WordTiming | null {
  const text = (b.text ?? '').trim();
  if (!text) return null;
  const startSec = Math.max(0, b.offset / TICKS_PER_SEC);
  const endSec = Math.max(startSec + 0.05, (b.offset + b.duration) / TICKS_PER_SEC);
  return { text, startSec, endSec };
}

export function boundariesToWordTimings(boundaries: WordBoundaryLike[]): WordTiming[] {
  const out: WordTiming[] = [];
  for (const b of boundaries) {
    const t = wordBoundaryToTiming(b);
    if (t) out.push(t);
  }
  return out;
}

/** Group word timings into phrase cues using punctuation / max length. */
export function buildPhraseCuesFromWordTimings(
  words: WordTiming[],
  sceneStartSec: number,
  durationSec: number,
  maxPhraseLen = 42,
): Array<{ startSec: number; endSec: number; text: string }> {
  if (words.length === 0 || durationSec <= 0) return [];

  const sceneEnd = sceneStartSec + durationSec;
  const cues: Array<{ startSec: number; endSec: number; text: string }> = [];
  let buf: WordTiming[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    const text = buf.map((w) => w.text).join(' ');
    const startSec = sceneStartSec + buf[0]!.startSec;
    const endSec = Math.min(sceneEnd, sceneStartSec + buf[buf.length - 1]!.endSec);
    if (endSec - startSec >= 0.12) {
      cues.push({ startSec, endSec: Math.max(startSec + 0.15, endSec), text });
    }
    buf = [];
  };

  for (const word of words) {
    buf.push(word);
    const text = buf.map((w) => w.text).join(' ');
    const endsSentence = /[.!?…]$/.test(word.text);
    if (endsSentence || text.length >= maxPhraseLen) {
      flush();
    }
  }
  flush();

  if (cues.length > 0) {
    cues[0]!.startSec = Math.min(cues[0]!.startSec, sceneStartSec);
    cues[cues.length - 1]!.endSec = sceneEnd;
  }

  return cues;
}

/**
 * Build ASS karaoke (\kf) using real word durations (centiseconds).
 * Falls back to empty dialogue block if no words.
 */
export function buildKaraokeAssFromWordTimings(
  words: WordTiming[],
  durationSec: number,
  options?: { fontSize?: number; alignment?: number; marginV?: number },
): string {
  const fontSize = options?.fontSize ?? 42;
  const alignment = options?.alignment ?? 2;
  const marginV = options?.marginV ?? 64;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H0000FFFF,&H00111111,&H66000000,1,0,0,0,100,100,0.4,0,3,1.8,0,${alignment},40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (words.length === 0 || durationSec <= 0) return header;

  const karaokeParts = words.map((word, i) => {
    const nextStart = words[i + 1]?.startSec;
    const rawDur = Math.max(0.05, (nextStart ?? word.endSec) - word.startSec);
    const cs = Math.max(1, Math.round(rawDur * 100));
    const escaped = word.text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
    return `{\\kf${cs}}${escaped}`;
  });

  const endTime = formatAssTime(durationSec);
  return `${header}Dialogue: 0,0:00:00.00,${endTime},Default,,0,0,0,,${karaokeParts.join(' ')}
`;
}

function formatAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
