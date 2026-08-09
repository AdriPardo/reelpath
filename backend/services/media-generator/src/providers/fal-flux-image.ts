/**
 * fal.ai FLUX 1.1 [pro] — high-quality text-to-image (~$0.04/img).
 * Uses sync HTTP (no @fal-ai/client dependency).
 */

import fs from 'node:fs/promises';

export type FalFluxImageParams = {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: '9:16' | '16:9';
  /** Abort / overall timeout ms (default 120s). */
  timeoutMs?: number;
};

export type FalFluxImageResult = {
  url: string;
  width?: number;
  height?: number;
  contentType?: string;
};

function imageSizeForAspect(aspectRatio: '9:16' | '16:9'): {
  width: number;
  height: number;
} {
  // Match OpenAI gpt-image landscape/portrait ~1.5MP for upscale parity.
  return aspectRatio === '9:16'
    ? { width: 1024, height: 1536 }
    : { width: 1536, height: 1024 };
}

function authorize(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.toLowerCase().startsWith('key ')) return trimmed;
  return `Key ${trimmed}`;
}

/**
 * Generate one image via fal.run sync endpoint.
 * @see https://fal.ai/models/fal-ai/flux-pro/v1.1/api
 */
export async function generateFalFluxImage(
  params: FalFluxImageParams,
): Promise<FalFluxImageResult> {
  const model = params.model.trim().replace(/^\/+/, '');
  if (!model) throw new Error('FAL image model empty');

  const size = imageSizeForAspect(params.aspectRatio);
  const timeoutMs = params.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: authorize(params.apiKey),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        image_size: size,
        num_images: 1,
        output_format: 'png',
        safety_tolerance: '2',
        enhance_prompt: false,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`fal ${model} failed (${res.status}): ${text.slice(0, 280)}`);
    }

    let data: {
      images?: Array<{
        url?: string;
        width?: number;
        height?: number;
        content_type?: string;
      }>;
      detail?: unknown;
    };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(`fal ${model} returned non-JSON`);
    }

    const image = data.images?.[0];
    const url = image?.url?.trim();
    if (!image || !url) {
      throw new Error(`fal ${model} response missing images[0].url`);
    }

    return {
      url,
      width: image.width,
      height: image.height,
      contentType: image.content_type,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadFalImageToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download fal image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('Empty fal image download');
  await fs.writeFile(outPath, buf);
}
