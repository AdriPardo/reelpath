import { deflateSync } from 'node:zlib';

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function createPng(rgb: Buffer, width: number, height: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + width * 3;
  const rawRows = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    rawRows[y * rowSize] = 0;
    rgb.copy(rawRows, y * rowSize + 1, y * width * 3, (y + 1) * width * 3);
  }

  const compressed = deflateSync(rawRows);
  const chunks: Buffer[] = [signature];

  const writeChunk = (type: string, data: Buffer) => {
    const typeBuf = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    chunks.push(len, typeBuf, data, crcBuf);
  };

  writeChunk('IHDR', ihdr);
  writeChunk('IDAT', compressed);
  writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat(chunks);
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace(/^0x/i, '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blendPixel(
  raw: Buffer,
  width: number,
  x: number,
  y: number,
  color: [number, number, number],
  alpha: number,
): void {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 3;
  raw[i] = clampByte(lerp(raw[i], color[0], alpha));
  raw[i + 1] = clampByte(lerp(raw[i + 1], color[1], alpha));
  raw[i + 2] = clampByte(lerp(raw[i + 2], color[2], alpha));
}

function fillCircle(
  raw: Buffer,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  color: [number, number, number],
  alpha: number,
): void {
  const r2 = radius * radius;
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        blendPixel(raw, width, x, y, color, alpha);
      }
    }
  }
}

function fillRect(
  raw: Buffer,
  width: number,
  height: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: [number, number, number],
  alpha: number,
): void {
  for (let y = Math.max(0, y0); y < Math.min(height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
      blendPixel(raw, width, x, y, color, alpha);
    }
  }
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const SCENE_PALETTES: Array<{
  top: string;
  bottom: string;
  accent: string;
  highlight: string;
}> = [
  { top: '0x1a1a2e', bottom: '0xe94560', accent: '0xff6b6b', highlight: '0xfeca57' },
  { top: '0x0f2027', bottom: '0x2c5364', accent: '0x4ecdc4', highlight: '0xffe66d' },
  { top: '0x141e30', bottom: '0x243b55', accent: '0x6c5ce7', highlight: '0xa29bfe' },
  { top: '0x200122', bottom: '0x6f0000', accent: '0xff7675', highlight: '0xfdcb6e' },
  { top: '0x0f0c29', bottom: '0x302b63', accent: '0x00cec9', highlight: '0x81ecec' },
  { top: '0x232526', bottom: '0x414345', accent: '0x0984e3', highlight: '0x74b9ff' },
];

export function createGradientPng(
  width: number,
  height: number,
  topHex: string,
  bottomHex: string,
): Buffer {
  const top = parseHexColor(topHex);
  const bottom = parseHexColor(bottomHex);
  const raw = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y++) {
    const t = height > 1 ? y / (height - 1) : 0;
    const r = Math.round(top[0] * (1 - t) + bottom[0] * t);
    const g = Math.round(top[1] * (1 - t) + bottom[1] * t);
    const b = Math.round(top[2] * (1 - t) + bottom[2] * t);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }

  return createPng(raw, width, height);
}

export function createSceneVisualPng(
  width: number,
  height: number,
  sceneIndex: number,
  visualPrompt = '',
): Buffer {
  const palette = SCENE_PALETTES[sceneIndex % SCENE_PALETTES.length];
  const top = parseHexColor(palette.top);
  const bottom = parseHexColor(palette.bottom);
  const accent = parseHexColor(palette.accent);
  const highlight = parseHexColor(palette.highlight);
  const rand = seededRandom(hashSeed(`${sceneIndex}:${visualPrompt}`));
  const raw = Buffer.alloc(width * height * 3);

  const cx = width * (0.35 + rand() * 0.3);
  const cy = height * (0.3 + rand() * 0.25);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const vertical = height > 1 ? y / (height - 1) : 0;
      const dx = (x - cx) / width;
      const dy = (y - cy) / height;
      const radial = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.8);
      const t = vertical * 0.65 + radial * 0.35;

      const i = (y * width + x) * 3;
      raw[i] = clampByte(lerp(top[0], bottom[0], t));
      raw[i + 1] = clampByte(lerp(top[1], bottom[1], t));
      raw[i + 2] = clampByte(lerp(top[2], bottom[2], t));
    }
  }

  const style = sceneIndex % 4;

  if (style === 0 || style === 2) {
    for (let i = 0; i < 5 + Math.floor(rand() * 4); i++) {
      fillCircle(
        raw,
        width,
        height,
        rand() * width,
        rand() * height,
        80 + rand() * 220,
        i % 2 === 0 ? accent : highlight,
        0.18 + rand() * 0.22,
      );
    }
  }

  if (style === 1 || style === 3) {
    const stripeCount = 6 + Math.floor(rand() * 5);
    for (let s = 0; s < stripeCount; s++) {
      const offset = (s / stripeCount) * (width + height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const diag = x + y;
          if (Math.abs((diag - offset) % 120) < 28) {
            blendPixel(raw, width, x, y, s % 2 === 0 ? accent : highlight, 0.12 + rand() * 0.08);
          }
        }
      }
    }
  }

  const gridStep = 90 + Math.floor(rand() * 40);
  for (let y = gridStep; y < height; y += gridStep) {
    fillRect(raw, width, height, 0, y, width, 2, highlight, 0.08);
  }
  for (let x = gridStep; x < width; x += gridStep) {
    fillRect(raw, width, height, x, 0, 2, height, accent, 0.08);
  }

  fillCircle(raw, width, height, cx, cy, Math.min(width, height) * 0.22, highlight, 0.28);
  fillCircle(raw, width, height, width * 0.82, height * 0.18, 120, accent, 0.2);
  fillRect(
    raw,
    width,
    height,
    Math.floor(width * 0.08),
    Math.floor(height * 0.72),
    Math.floor(width * 0.35),
    8,
    highlight,
    0.35,
  );
  fillRect(
    raw,
    width,
    height,
    Math.floor(width * 0.55),
    Math.floor(height * 0.78),
    Math.floor(width * 0.32),
    8,
    accent,
    0.3,
  );

  for (let y = 0; y < height; y++) {
    const edge = Math.min(y, height - 1 - y) / (height * 0.12);
    const vignette = Math.max(0, Math.min(1, edge));
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[i] = clampByte(raw[i] * vignette);
      raw[i + 1] = clampByte(raw[i + 1] * vignette);
      raw[i + 2] = clampByte(raw[i + 2] * vignette);
    }
  }

  return createPng(raw, width, height);
}
