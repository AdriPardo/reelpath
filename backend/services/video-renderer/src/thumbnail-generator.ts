import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { runFfmpeg } from '@autotube/shared/ffmpeg-runner';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type YouTubeThumbVariant = 'auto' | 'A' | 'B' | 'C';

/** Con overlay corto (CTR) siempre preferimos layout de impacto A. */
function pickYouTubeVariant(overlayText: string): Exclude<YouTubeThumbVariant, 'auto'> {
  const words = overlayText.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 4 && overlayText.length <= 32) return 'A';
  if (words.length <= 6 && overlayText.length <= 48) return 'B';
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

/** Renderiza una línea con highlightWord en amarillo (resto blanco). */
function buildHighlightedLineText(params: {
  line: string;
  highlightWord?: string | null;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  anchor?: 'start' | 'middle';
}): string {
  const { line, highlightWord, x, y, fontSize, fontFamily } = params;
  const anchor = params.anchor ?? 'start';
  const strokeW = Math.max(5, Math.round(fontSize * 0.14));
  const accent = '#FFE566';
  const hl = highlightWord?.trim().toUpperCase() || '';
  const words = line.split(/\s+/).filter(Boolean);

  if (!hl || !words.some((w) => w.toUpperCase() === hl || w.toUpperCase().includes(hl))) {
    return `
  <text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="900"
    fill="#FFFFFF" stroke="rgba(0,0,0,0.92)" stroke-width="${strokeW}"
    paint-order="stroke fill" letter-spacing="0.8" filter="url(#shadow)">${escapeXml(line)}</text>`;
  }

  // tspans: palabra highlight en amarillo.
  const tspans = words
    .map((w, i) => {
      const match = w.toUpperCase() === hl || w.toUpperCase().includes(hl);
      const fill = match ? accent : '#FFFFFF';
      const pad = i === 0 ? '' : ' ';
      return `<tspan fill="${fill}">${escapeXml(pad + w)}</tspan>`;
    })
    .join('');

  return `
  <text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="900"
    stroke="rgba(0,0,0,0.92)" stroke-width="${strokeW}"
    paint-order="stroke fill" letter-spacing="0.8" filter="url(#shadow)">${tspans}</text>`;
}

function buildYouTubeOverlaySvg(params: {
  title: string;
  width: number;
  height: number;
  variant: Exclude<YouTubeThumbVariant, 'auto'>;
  brandLabel?: string | null;
  highlightWord?: string | null;
}): Buffer {
  const { title, width, height, variant, brandLabel, highlightWord } = params;
  const safeX = Math.round(width * 0.045);
  const safeY = Math.round(height * 0.055);
  const accent = '#FFE566';
  const fontFamily = 'Arial Black, Impact, Arial, Helvetica, sans-serif';
  const titleUpper = title.trim().toUpperCase();

  const defs = `
  <defs>
    <linearGradient id="gradBottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="35%" stop-color="rgba(0,0,0,0.15)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.94)"/>
    </linearGradient>
    <linearGradient id="gradLeft" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,0.95)"/>
      <stop offset="55%" stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.85)"/>
    </filter>
  </defs>`;

  const border = `
  <rect x="${Math.round(width * 0.01)}" y="${Math.round(height * 0.015)}" width="${Math.round(
    width * 0.98,
  )}" height="${Math.round(height * 0.97)}" rx="${Math.round(width * 0.012)}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="${Math.max(
    3,
    Math.round(width * 0.0035),
  )}"/>
  `;

  const badge = brandLabel
    ? `
  <g filter="url(#shadow)">
    <rect x="${safeX}" y="${safeY}" width="${Math.min(
        Math.round(width * 0.36),
        Math.round(brandLabel.length * width * 0.022 + width * 0.08),
      )}" height="${Math.round(
        height * 0.08,
      )}" rx="${Math.round(height * 0.018)}" fill="rgba(0,0,0,0.72)"/>
    <rect x="${safeX + Math.round(width * 0.01)}" y="${safeY + Math.round(height * 0.014)}" width="${Math.round(
        width * 0.018,
      )}" height="${Math.round(height * 0.052)}" rx="${Math.round(height * 0.01)}" fill="${accent}"/>
    <text x="${safeX + Math.round(width * 0.04)}" y="${safeY + Math.round(
        height * 0.055,
      )}" fill="#FFFFFF" font-family="${fontFamily}" font-size="${Math.round(
        height * 0.038,
      )}" font-weight="800" letter-spacing="0.6">${escapeXml(brandLabel.toUpperCase())}</text>
  </g>
`
    : '';

  if (variant === 'A') {
    // Impacto inferior: tipografía GIGANTE (legible a 160px de ancho).
    const lines = wrapTitleLines(titleUpper, 18, 2);
    const fontSize = Math.round(height * (lines.length === 1 ? 0.145 : 0.12));
    const lineGap = Math.round(fontSize * 1.02);
    const blockPad = Math.round(height * 0.06);
    const blockH = Math.round(blockPad + lines.length * lineGap + height * 0.04);
    const y0 = height - blockH;

    const titleEls = lines
      .map((line, i) =>
        buildHighlightedLineText({
          line,
          highlightWord,
          x: safeX,
          y: y0 + Math.round(blockPad) + (i + 1) * lineGap,
          fontSize,
          fontFamily,
        }),
      )
      .join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs}
  <rect width="${width}" height="${height}" fill="url(#gradBottom)"/>
  <rect x="0" y="${y0}" width="${width}" height="${blockH}" fill="rgba(0,0,0,0.55)"/>
  ${badge}
  ${titleEls}
  ${border}
</svg>`;
    return Buffer.from(svg);
  }

  if (variant === 'B') {
    const lines = wrapTitleLines(titleUpper, 14, 3);
    const fontSize = Math.round(height * 0.11);
    const lineGap = Math.round(fontSize * 1.05);
    const x0 = safeX;
    const y0 = Math.round(height * 0.28);

    const titleEls = lines
      .map((line, i) =>
        buildHighlightedLineText({
          line,
          highlightWord,
          x: x0,
          y: y0 + (i + 1) * lineGap,
          fontSize,
          fontFamily,
        }),
      )
      .join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs}
  <rect width="${Math.round(width * 0.58)}" height="${height}" fill="url(#gradLeft)"/>
  <rect x="${safeX}" y="${Math.round(height * 0.22)}" width="${Math.round(
      width * 0.016,
    )}" height="${Math.round(height * 0.56)}" rx="${Math.round(height * 0.015)}" fill="${accent}" opacity="0.98"/>
  ${badge}
  ${titleEls}
  ${border}
</svg>`;
    return Buffer.from(svg);
  }

  // variant C — caja central
  const lines = wrapTitleLines(titleUpper, 16, 2);
  const fontSize = Math.round(height * 0.125);
  const lineGap = Math.round(fontSize * 1.05);
  const blockW = Math.round(width * 0.9);
  const blockH = Math.round(height * 0.38);
  const x = Math.round((width - blockW) / 2);
  const y = Math.round(height * 0.52 - blockH / 2);

  const titleEls = lines
    .map((line, i) => {
      const ty = y + Math.round(height * 0.1) + (i + 1) * lineGap;
      return buildHighlightedLineText({
        line,
        highlightWord,
        x: Math.round(width / 2),
        y: ty,
        fontSize,
        fontFamily,
        anchor: 'middle',
      });
    })
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs}
  <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.28)"/>
  <rect x="${x}" y="${y}" width="${blockW}" height="${blockH}" rx="${Math.round(
    height * 0.04,
  )}" fill="rgba(0,0,0,0.78)"/>
  <rect x="${x + Math.round(width * 0.02)}" y="${y + Math.round(height * 0.05)}" width="${Math.round(
    width * 0.028,
  )}" height="${Math.round(height * 0.28)}" rx="${Math.round(height * 0.02)}" fill="${accent}" opacity="0.98"/>
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
  highlightWord?: string | null;
}): Buffer {
  const { title, partLabel, width, height, highlightWord } = params;
  const titleLines = wrapTitleLines(title.toUpperCase(), 16, 2);
  const badgeY = Math.round(height * 0.08);
  const partSize = 42;
  const titleSize = Math.round(width * 0.085);
  const lineGap = Math.round(titleSize * 1.12);
  const paddingTop = partLabel ? 56 : 40;
  const titleStartY = partLabel ? paddingTop + 18 : paddingTop;
  const badgeH = titleStartY + titleLines.length * lineGap + 36;
  const fontFamily = 'Arial Black, Impact, Arial, Helvetica, sans-serif';

  const partLine = partLabel
    ? `<text x="${width / 2}" y="${badgeY + paddingTop}" text-anchor="middle" fill="#FFE566" font-family="${fontFamily}" font-size="${partSize}" font-weight="800">${escapeXml(partLabel)}</text>`
    : '';

  const titleEls = titleLines
    .map((line, i) => {
      const y = badgeY + titleStartY + (i + 1) * lineGap;
      return buildHighlightedLineText({
        line,
        highlightWord,
        x: width / 2,
        y,
        fontSize: titleSize,
        fontFamily,
        anchor: 'middle',
      });
    })
    .join('\n  ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.85)"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#v)"/>
  <rect x="0" y="${badgeY}" width="${width}" height="${badgeH}" fill="rgba(0,0,0,0.88)"/>
  ${partLine}
  ${titleEls}
</svg>`;

  return Buffer.from(svg);
}

async function extractFrame(videoPath: string, outPath: string, atSec = 0.5): Promise<void> {
  await runFfmpeg([
    '-ss', String(atSec),
    '-i', videoPath,
    '-frames:v', '1',
    '-q:v', '2',
    '-y', outPath,
  ]);
}

/** Sube contraste/saturación del fondo para que “pegue” en el feed. */
async function punchBackground(inputPath: string, outputPath: string, width: number, height: number): Promise<void> {
  await sharp(inputPath)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 1.05, saturation: 1.35 })
    .linear(1.12, -8)
    .jpeg({ quality: 92 })
    .toFile(outputPath);
}

/** Miniatura 16:9 CTR-first: fondo punchy + overlay gigante + highlight. */
export async function generateYouTubeThumbnail(params: {
  title: string;
  overlayText?: string | null;
  highlightWord?: string | null;
  backgroundImagePath?: string | null;
  videoPath?: string;
  outputPath: string;
  width?: number;
  height?: number;
  variant?: YouTubeThumbVariant;
  brandLabel?: string | null;
}): Promise<string> {
  const width = params.width ?? 1280;
  const height = params.height ?? 720;
  const overlaySource = (params.overlayText?.trim() || params.title).trim();
  const resolvedVariant =
    (params.variant ?? 'auto') === 'auto'
      ? pickYouTubeVariant(overlaySource)
      : (params.variant as Exclude<YouTubeThumbVariant, 'auto'>);
  const workDir = path.join(path.dirname(params.outputPath), '.thumb-work');
  await fs.mkdir(workDir, { recursive: true });

  const rawFrame = path.join(workDir, 'frame-raw.jpg');
  const framePath = path.join(workDir, 'frame.jpg');

  if (params.backgroundImagePath) {
    try {
      await fs.access(params.backgroundImagePath);
      await sharp(params.backgroundImagePath)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 92 })
        .toFile(rawFrame);
    } catch {
      if (params.videoPath) {
        await extractFrame(params.videoPath, rawFrame, 1);
      } else {
        await sharp({
          create: { width, height, channels: 3, background: { r: 12, g: 14, b: 22 } },
        })
          .jpeg()
          .toFile(rawFrame);
      }
    }
  } else if (params.videoPath) {
    await extractFrame(params.videoPath, rawFrame, 1);
  } else {
    await sharp({
      create: { width, height, channels: 3, background: { r: 12, g: 14, b: 22 } },
    })
      .jpeg()
      .toFile(rawFrame);
  }

  await punchBackground(rawFrame, framePath, width, height);

  const overlayPng = path.join(workDir, 'overlay.png');
  await sharp(
    buildYouTubeOverlaySvg({
      title: overlaySource,
      width,
      height,
      variant: resolvedVariant,
      brandLabel: params.brandLabel ?? null,
      highlightWord: params.highlightWord,
    }),
  )
    .png()
    .toFile(overlayPng);

  await sharp(framePath)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .jpeg({ quality: 94 })
    .toFile(params.outputPath);

  return params.outputPath;
}

/** Miniatura 9:16 CTR-first para Shorts. */
export async function generateVerticalClipThumbnail(params: {
  title: string;
  overlayText?: string | null;
  highlightWord?: string | null;
  partIndex: number;
  partCount: number;
  videoPath: string;
  outputPath: string;
  showPartLabel?: boolean;
  backgroundImagePath?: string | null;
}): Promise<string> {
  const width = 1080;
  const height = 1920;
  const workDir = path.join(path.dirname(params.outputPath), '.thumb-work');
  await fs.mkdir(workDir, { recursive: true });

  const rawFrame = path.join(workDir, `frame-raw-p${params.partIndex}.jpg`);
  const framePath = path.join(workDir, `frame-p${params.partIndex}.jpg`);
  if (params.backgroundImagePath) {
    try {
      await fs.access(params.backgroundImagePath);
      await sharp(params.backgroundImagePath)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 92 })
        .toFile(rawFrame);
    } catch {
      await extractFrame(params.videoPath, rawFrame, 0.4);
    }
  } else {
    await extractFrame(params.videoPath, rawFrame, 0.4);
  }

  await punchBackground(rawFrame, framePath, width, height);

  const showPartLabel = params.showPartLabel !== false;
  const partLabel = showPartLabel
    ? params.partCount > 1
      ? `Parte ${params.partIndex + 1} de ${params.partCount}`
      : null
    : null;

  const overlayPng = path.join(workDir, `overlay-p${params.partIndex}.png`);
  await sharp(
    buildVerticalOverlaySvg({
      title: (params.overlayText?.trim() || params.title).trim(),
      partLabel,
      width,
      height,
      highlightWord: params.highlightWord,
    }),
  )
    .png()
    .toFile(overlayPng);

  await sharp(framePath)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .jpeg({ quality: 94 })
    .toFile(params.outputPath);

  return params.outputPath;
}
