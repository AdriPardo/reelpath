import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { assertValidVideoFile, ffmpegH264EncodeArgs } from './ffmpeg-utils.js';
import { sliceSrtCues, parseSrt, type SrtCue } from './srt-utils.js';

const execFileAsync = promisify(execFile);

const WIDTH = 1080;
const VIDEO_H = 1920;
const SUB_BOTTOM_MARGIN = 100;
const MAX_LINES = 5;
const CHARS_PER_LINE = 34;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapLines(text: string): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > CHARS_PER_LINE && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= MAX_LINES) break;
  }

  if (lines.length < MAX_LINES && current) lines.push(current);
  if (lines.length === MAX_LINES && words.join(' ').length > lines.join(' ').length) {
    const last = lines[MAX_LINES - 1]!;
    if (!last.endsWith('…')) lines[MAX_LINES - 1] = `${last.replace(/\s+\S+$/, '')}…`;
  }

  return lines.length > 0 ? lines : [text.slice(0, CHARS_PER_LINE)];
}

function buildSubtitleSvg(lines: string[]): { svg: string; height: number } {
  const lineHeight = 42;
  const padY = 20;
  const height = padY * 2 + lines.length * lineHeight;
  const textEls = lines
    .map((line, i) => {
      const y = padY + 32 + i * lineHeight;
      return `<text x="540" y="${y}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join('\n  ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
  <rect width="${WIDTH}" height="${height}" fill="rgba(0,0,0,0.75)" rx="8"/>
  ${textEls}
</svg>`;

  return { svg, height };
}

async function renderCuePng(text: string, outPath: string): Promise<number> {
  const { svg, height } = buildSubtitleSvg(wrapLines(text));
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  return height;
}

export function subClipPath(rawPath: string): string {
  return rawPath.replace(/\.raw\.mp4$/, '.sub.mp4');
}

export async function loadPipelineSrt(pipelineRunId: string): Promise<SrtCue[] | null> {
  const { getStoragePath } = await import('@autotube/config');
  const srtPath = getStoragePath('pipelines', pipelineRunId, 'subtitles.srt');
  try {
    const content = await fs.readFile(srtPath, 'utf8');
    return parseSrt(content);
  } catch {
    return null;
  }
}

/** Quema subtítulos SRT en un clip vertical (PNG overlays, sin filtro subtitles). */
export async function burnSubtitlesIntoClip(params: {
  inputPath: string;
  outputPath: string;
  cues: SrtCue[];
  startSec: number;
  durationSec: number;
}): Promise<boolean> {
  await assertValidVideoFile(params.inputPath, {
    expectedDurationSec: params.durationSec,
  });

  const sliced = sliceSrtCues(params.cues, params.startSec, params.durationSec);
  if (sliced.length === 0) {
    await fs.copyFile(params.inputPath, params.outputPath);
    return false;
  }

  const workDir = path.join(path.dirname(params.inputPath), '.subtitle-work');
  await fs.mkdir(workDir, { recursive: true });

  const pngPaths: string[] = [];
  const overlays: Array<{ png: string; y: number; start: number; end: number }> = [];

  for (let i = 0; i < sliced.length; i++) {
    const cue = sliced[i]!;
    const pngPath = path.join(workDir, `cue-${i}.png`);
    const h = await renderCuePng(cue.text, pngPath);
    pngPaths.push(pngPath);
    overlays.push({
      png: pngPath,
      y: VIDEO_H - h - SUB_BOTTOM_MARGIN,
      start: cue.startSec,
      end: cue.endSec,
    });
  }

  const args: string[] = ['-i', params.inputPath];
  const clipDuration = params.durationSec;
  for (const png of pngPaths) {
    args.push('-loop', '1', '-t', String(clipDuration), '-i', png);
  }

  const filterParts: string[] = [];
  let prev = '[0:v]';
  for (let i = 0; i < overlays.length; i++) {
    const o = overlays[i]!;
    const inLabel = `[${i + 1}:v]`;
    const outLabel = i === overlays.length - 1 ? '[vout]' : `[v${i + 1}]`;
    const enable = `enable='between(t,${o.start.toFixed(3)},${o.end.toFixed(3)})'`;
    filterParts.push(`${prev}${inLabel}overlay=0:${o.y}:${enable}${outLabel}`);
    prev = outLabel;
  }

  const filter = filterParts.join(';');

  await execFileAsync('ffmpeg', [
    ...args,
    '-filter_complex', filter,
    '-map', '[vout]',
    '-map', '0:a?',
    ...ffmpegH264EncodeArgs({ audioCopy: true }),
    '-movflags', '+faststart',
    '-y', params.outputPath,
  ]);

  return true;
}
