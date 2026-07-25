import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type YouTubeThumbVariant = 'auto' | 'A' | 'B' | 'C';

function pickYouTubeVariant(title: string): Exclude<YouTubeThumbVariant, 'auto'> {
  const words = title.trim().split(/\s+/).filter(Boolean);
  // Heurística simple: títulos cortos → más “impacto” (A), largos → layout centrado (C).
  if (words.length <= 5 && title.length <= 42) return 'A';
  if (words.length <= 9 && title.length <= 70) return 'B';
  return 'C';
}


function wrapTitleLines(title: string, maxLen: number, maxLines: number): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLen) {
      current = next;
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
    last.length > maxLen - 1 ? `${last.slice(0, maxLen - 1)}…` : `${last}…`;
  return kept;
}

function buildYouTubeOverlaySvg(params: {
  title: string;
  width: number;
  height: number;
  variant: Exclude<YouTubeThumbVariant, 'auto'>;
  brandLabel?: string | null;
}): Buffer {
  const { title, width, height, variant, brandLabel } = params;
  const safeX = Math.round(width * 0.05);
  const safeY = Math.round(height * 0.07);
  const accent = '#F7C948';

  const fontFamily = 'Arial, Helvetica, sans-serif';
  const titleUpper = title.trim();

  const defs = `
  <defs>
    <linearGradient id="gradBottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="45%" stop-color="rgba(0,0,0,0.10)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.92)"/>
    </linearGradient>
    <linearGradient id="gradLeft" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,0.92)"/>
      <stop offset="70%" stop-color="rgba(0,0,0,0.12)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(0,0,0,0.55)"/>
    </filter>
  </defs>`;

  const border = `
  <rect x="${Math.round(width * 0.012)}" y="${Math.round(height * 0.02)}" width="${Math.round(
    width * 0.976,
  )}" height="${Math.round(height * 0.96)}" rx="${Math.round(width * 0.02)}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="${Math.max(
    2,
    Math.round(width * 0.003),
  )}"/>
  `;

  const badge = brandLabel
    ? `
  <g filter="url(#shadow)">
    <rect x="${safeX}" y="${safeY}" width="${Math.round(width * 0.34)}" height="${Math.round(
        height * 0.09,
      )}" rx="${Math.round(height * 0.022)}" fill="rgba(0,0,0,0.62)"/>
    <rect x="${safeX + Math.round(width * 0.01)}" y="${safeY + Math.round(height * 0.015)}" width="${Math.round(
        width * 0.02,
      )}" height="${Math.round(height * 0.06)}" rx="${Math.round(height * 0.015)}" fill="${accent}"/>
    <text x="${safeX + Math.round(width * 0.045)}" y="${safeY + Math.round(
        height * 0.062,
      )}" fill="#FFFFFF" font-family="${fontFamily}" font-size="${Math.round(
        height * 0.045,
      )}" font-weight="800" letter-spacing="0.5">${escapeXml(brandLabel)}</text>
  </g>
`
    : '';

  const titleCommon = (text: string, x: number, y: number, size: number) => `
  <text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${size}" font-weight="900"
    fill="#FFFFFF" stroke="rgba(0,0,0,0.85)" stroke-width="${Math.max(4, Math.round(size * 0.11))}"
    paint-order="stroke fill" letter-spacing="0.3" filter="url(#shadow)">${escapeXml(text)}</text>`;

  if (variant === 'A') {
    const lines = wrapTitleLines(titleUpper, 26, 3);
    const fontSize = Math.round(height * 0.095); // ~68 en 720p
    const lineGap = Math.round(fontSize * 1.05);
    const blockPad = Math.round(height * 0.085);
    const blockH = Math.round(blockPad + lines.length * lineGap + height * 0.03);
    const y0 = height - blockH;

    const titleEls = lines
      .map((line, i) => titleCommon(line, safeX, y0 + Math.round(blockPad) + (i + 1) * lineGap, fontSize))
      .join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs}
  <rect width="${width}" height="${height}" fill="url(#gradBottom)"/>
  ${badge}
  ${titleEls}
  ${border}
</svg>`;
    return Buffer.from(svg);
  }

  if (variant === 'B') {
    const lines = wrapTitleLines(titleUpper, 22, 4);
    const fontSize = Math.round(height * 0.085);
    const lineGap = Math.round(fontSize * 1.05);
    const x0 = safeX;
    const y0 = Math.round(height * 0.33);

    const titleEls = lines
      .map((line, i) => titleCommon(line, x0, y0 + (i + 1) * lineGap, fontSize))
      .join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs}
  <rect width="${Math.round(width * 0.62)}" height="${height}" fill="url(#gradLeft)"/>
  <rect x="${safeX}" y="${Math.round(height * 0.25)}" width="${Math.round(
      width * 0.014,
    )}" height="${Math.round(height * 0.55)}" rx="${Math.round(height * 0.02)}" fill="${accent}" opacity="0.95"/>
  ${badge}
  ${titleEls}
  ${border}
</svg>`;
    return Buffer.from(svg);
  }

  // variant C
  const lines = wrapTitleLines(titleUpper, 24, 3);
  const fontSize = Math.round(height * 0.1);
  const lineGap = Math.round(fontSize * 1.07);
  const blockW = Math.round(width * 0.86);
  const blockH = Math.round(height * 0.34);
  const x = Math.round((width - blockW) / 2);
  const y = Math.round(height * 0.54 - blockH / 2);

  const titleEls = lines
    .map((line, i) => {
      const ty = y + Math.round(height * 0.085) + (i + 1) * lineGap;
      return `
  <text x="${Math.round(width / 2)}" y="${ty}" text-anchor="middle"
    font-family="${fontFamily}" font-size="${fontSize}" font-weight="900"
    fill="#FFFFFF" stroke="rgba(0,0,0,0.85)" stroke-width="${Math.max(4, Math.round(fontSize * 0.11))}"
    paint-order="stroke fill" letter-spacing="0.3" filter="url(#shadow)">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs}
  <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.22)"/>
  <rect x="${x}" y="${y}" width="${blockW}" height="${blockH}" rx="${Math.round(
      height * 0.06,
    )}" fill="rgba(0,0,0,0.66)"/>
  <rect x="${x + Math.round(width * 0.02)}" y="${y + Math.round(height * 0.06)}" width="${Math.round(
      width * 0.03,
    )}" height="${Math.round(height * 0.22)}" rx="${Math.round(height * 0.03)}" fill="${accent}" opacity="0.95"/>
  ${badge}
  ${titleEls}
  ${border}
</svg>`;
  return Buffer.from(svg);
}

function buildVerticalOverlaySvg(params: {
  title: string;
  partLabel: string | null;
  width: number;
  height: number;
}): Buffer {
  const { title, partLabel, width, height } = params;
  const titleLines = wrapTitleLines(title, 30, 2);
  const badgeY = Math.round((height - width) / 2 + 20);
  const partSize = 36;
  const titleSize = 32;
  const lineGap = 44;
  const paddingTop = partLabel ? 48 : 36;
  const titleStartY = partLabel ? paddingTop + 14 : paddingTop;
  const badgeH = titleStartY + titleLines.length * lineGap + 24;

  const partLine = partLabel
    ? `<text x="${width / 2}" y="${badgeY + paddingTop}" text-anchor="middle" fill="#D4AF37" font-family="Arial, Helvetica, sans-serif" font-size="${partSize}" font-weight="800">${escapeXml(partLabel)}</text>`
    : '';

  const titleEls = titleLines
    .map((line, i) => {
      const y = badgeY + titleStartY + (i + 1) * lineGap;
      return `<text x="${width / 2}" y="${y}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="700">${escapeXml(line)}</text>`;
    })
    .join('\n  ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.35)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#v)"/>
  <rect x="0" y="${badgeY}" width="${width}" height="${badgeH}" fill="rgba(0,0,0,0.82)"/>
  ${partLine}
  ${titleEls}
</svg>`;

  return Buffer.from(svg);
}

async function extractFrame(videoPath: string, outPath: string, atSec = 0.5): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-ss', String(atSec),
    '-i', videoPath,
    '-frames:v', '1',
    '-q:v', '2',
    '-y', outPath,
  ]);
}

/** Miniatura 16:9 con imagen de fondo + título para YouTube. */
export async function generateYouTubeThumbnail(params: {
  title: string;
  backgroundImagePath?: string | null;
  videoPath?: string;
  outputPath: string;
  width?: number;
  height?: number;
  /** Variante de layout (A/B/C). En 'auto' elige según longitud del título. */
  variant?: YouTubeThumbVariant;
  /** Etiqueta de marca opcional (p. ej. nombre corto del canal). */
  brandLabel?: string | null;
}): Promise<string> {
  const width = params.width ?? 1280;
  const height = params.height ?? 720;
  const resolvedVariant = (params.variant ?? 'auto') === 'auto'
    ? pickYouTubeVariant(params.title)
    : (params.variant as Exclude<YouTubeThumbVariant, 'auto'>);
  const workDir = path.join(path.dirname(params.outputPath), '.thumb-work');
  await fs.mkdir(workDir, { recursive: true });

  const framePath = path.join(workDir, 'frame.jpg');

  if (params.backgroundImagePath) {
    try {
      await fs.access(params.backgroundImagePath);
      await sharp(params.backgroundImagePath)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 90 })
        .toFile(framePath);
    } catch {
      if (params.videoPath) {
        await extractFrame(params.videoPath, framePath, 1);
      } else {
        await sharp({
          create: { width, height, channels: 3, background: { r: 20, g: 24, b: 36 } },
        })
          .jpeg()
          .toFile(framePath);
      }
    }
  } else if (params.videoPath) {
    await extractFrame(params.videoPath, framePath, 1);
  } else {
    await sharp({
      create: { width, height, channels: 3, background: { r: 20, g: 24, b: 36 } },
    })
      .jpeg()
      .toFile(framePath);
  }

  const overlayPng = path.join(workDir, 'overlay.png');
  await sharp(
    buildYouTubeOverlaySvg({
      title: params.title,
      width,
      height,
      variant: resolvedVariant,
      brandLabel: params.brandLabel ?? null,
    }),
  )
    .png()
    .toFile(overlayPng);

  await sharp(framePath)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(params.outputPath);

  return params.outputPath;
}

/** Miniatura 9:16 con badge de parte para clips verticales (Shorts). */
export async function generateVerticalClipThumbnail(params: {
  title: string;
  partIndex: number;
  partCount: number;
  videoPath: string;
  outputPath: string;
  showPartLabel?: boolean;
}): Promise<string> {
  const width = 1080;
  const height = 1920;
  const workDir = path.join(path.dirname(params.outputPath), '.thumb-work');
  await fs.mkdir(workDir, { recursive: true });

  const framePath = path.join(workDir, `frame-p${params.partIndex}.jpg`);
  await extractFrame(params.videoPath, framePath, 0.4);

  const showPartLabel = params.showPartLabel !== false;
  const partLabel = showPartLabel
    ? params.partCount > 1
      ? `Parte ${params.partIndex + 1} de ${params.partCount}`
      : 'Clip completo'
    : null;

  const overlayPng = path.join(workDir, `overlay-p${params.partIndex}.png`);
  await sharp(
    buildVerticalOverlaySvg({
      title: params.title,
      partLabel,
      width,
      height,
    }),
  )
    .png()
    .toFile(overlayPng);

  await sharp(framePath)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toFile(params.outputPath);

  return params.outputPath;
}
