import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { runFfmpeg } from '@autotube/shared';
import { FFMPEG_STRIP_METADATA_ARGS, ffmpegH264EncodeArgs } from './ffmpeg-utils.js';

const WIDTH = 1080;
const HEIGHT = 1920;
/** El recorte cuadrado de miniaturas deja y≈440 dentro de la zona visible. */
const BADGE_Y = Math.round((HEIGHT - WIDTH) / 2 + 20);
const TITLE_MAX_CHARS_PER_LINE = 30;
const TITLE_MAX_LINES = 2;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ajusta el título en varias líneas por palabras (sin cortar palabras). */
function wrapTitle(title: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1]!;
  kept[maxLines - 1] =
    last.length > maxCharsPerLine - 1 ? `${last.slice(0, maxCharsPerLine - 1)}…` : `${last}…`;
  return kept;
}

function buildThumbnailBadgeSvg(
  partLabel: string | null,
  videoTitle: string,
): { svg: string; height: number } {
  const titleLines = wrapTitle(videoTitle, TITLE_MAX_CHARS_PER_LINE, TITLE_MAX_LINES);
  const paddingTop = partLabel ? 34 : 28;
  const partSize = 34;
  const titleSize = 30;
  const lineGap = 42;
  const titleStartY = partLabel ? paddingTop + partSize + 14 : paddingTop;

  const partLine = partLabel
    ? `  <text x="540" y="${paddingTop + partSize}" text-anchor="middle" fill="#D4AF37" font-family="Arial, Helvetica, sans-serif" font-size="${partSize}" font-weight="800">${escapeXml(partLabel)}</text>\n`
    : '';

  const titleTexts = titleLines
    .map((line, i) => {
      const y = titleStartY + (i + 1) * lineGap;
      return `  <text x="540" y="${y}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="600">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const height = titleStartY + titleLines.length * lineGap + 24;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
  <rect width="${WIDTH}" height="${height}" fill="rgba(0,0,0,0.78)"/>
${partLine}${titleTexts}
</svg>`;
  return { svg, height };
}

export function rawClipPath(publishedPath: string): string {
  return publishedPath.replace(/\.mp4$/, '.raw.mp4');
}

/** Badge con parte + título en la zona visible del clip vertical (9:16). */
export async function applyClipOverlay(params: {
  inputPath: string;
  outputPath: string;
  videoTitle: string;
  partIndex: number;
  partCount: number;
  /** When false, only the title is shown (dedicated teaser shorts). */
  showPartLabel?: boolean;
}): Promise<void> {
  const { inputPath, outputPath, videoTitle, partIndex, partCount, showPartLabel = true } = params;
  const partLabel = showPartLabel
    ? partCount > 1
      ? `Parte ${partIndex + 1} de ${partCount}`
      : 'Clip completo'
    : null;

  const workDir = path.join(path.dirname(inputPath), '.overlay-work');
  await fs.mkdir(workDir, { recursive: true });
  const badgePng = path.join(workDir, `badge-p${partIndex}.png`);
  const { svg } = buildThumbnailBadgeSvg(partLabel, videoTitle);
  await sharp(Buffer.from(svg)).png().toFile(badgePng);

  await runFfmpeg([
    '-i', inputPath,
    '-i', badgePng,
    '-filter_complex', `[0:v][1:v]overlay=0:${BADGE_Y}[vout]`,
    '-map', '[vout]',
    '-map', '0:a?',
    ...ffmpegH264EncodeArgs({ audioCopy: true }),
    ...FFMPEG_STRIP_METADATA_ARGS,
    '-movflags', '+faststart',
    '-y', outputPath,
  ]);
}
