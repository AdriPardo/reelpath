/**
 * fal.ai image-to-video (Hailuo-02 standard by default).
 * Animates a still scene image into a short silent clip (~$0.27 / 6s).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export type FalI2vParams = {
  apiKey: string;
  model: string;
  imagePath: string;
  outPath: string;
  prompt: string;
  /** Hailuo duration enum as string: "6" | "10" */
  durationSec?: '6' | '10';
  timeoutMs?: number;
};

function authorize(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.toLowerCase().startsWith('key ')) return trimmed;
  return `Key ${trimmed}`;
}

async function uploadImageToFal(apiKey: string, imagePath: string): Promise<string> {
  const buf = await fs.readFile(imagePath);
  if (!buf.length) throw new Error('Empty image for fal upload');
  const contentType = imagePath.toLowerCase().endsWith('.jpg') || imagePath.toLowerCase().endsWith('.jpeg')
    ? 'image/jpeg'
    : 'image/png';
  const fileName = path.basename(imagePath) || 'scene.png';
  const auth = authorize(apiKey);

  // 1) Direct CDN upload (preferred; avoids huge data URIs).
  try {
    const direct = await fetch('https://fal.media/files/v1/upload', {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': contentType,
        'X-Fal-File-Name': fileName,
        Accept: 'application/json',
      },
      body: buf,
    });
    const directText = await direct.text();
    if (direct.ok) {
      const parsed = JSON.parse(directText) as {
        access_url?: string;
        url?: string;
        file_url?: string;
      };
      const url = parsed.access_url || parsed.url || parsed.file_url;
      if (url?.trim()) return url.trim();
    } else {
      console.warn(`[fal-i2v] fal.media upload failed (${direct.status}): ${directText.slice(0, 160)}`);
    }
  } catch (err) {
    console.warn(
      '[fal-i2v] fal.media upload error:',
      err instanceof Error ? err.message : err,
    );
  }

  // 2) Initiate + PUT (legacy alpha storage).
  try {
    const initRes = await fetch(
      'https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3',
      {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          file_name: fileName,
          content_type: contentType,
        }),
      },
    );
    const initText = await initRes.text();
    if (initRes.ok) {
      const initiated = JSON.parse(initText) as {
        upload_url?: string;
        file_url?: string;
      };
      if (initiated.upload_url && initiated.file_url) {
        const put = await fetch(initiated.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: buf,
        });
        if (put.ok) return initiated.file_url;
        console.warn(`[fal-i2v] upload PUT failed (${put.status})`);
      }
    } else {
      console.warn(`[fal-i2v] upload initiate failed (${initRes.status}): ${initText.slice(0, 160)}`);
    }
  } catch (err) {
    console.warn(
      '[fal-i2v] upload initiate error:',
      err instanceof Error ? err.message : err,
    );
  }

  // 3) Last resort: data URI (may fail for large PNGs on some models).
  if (buf.length > 4_500_000) {
    throw new Error(
      `fal upload failed and image too large for data URI (${buf.length} bytes)`,
    );
  }
  console.warn('[fal-i2v] falling back to data URI for image_url');
  return `data:${contentType};base64,${buf.toString('base64')}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function isTerminalSuccess(status?: string): boolean {
  const s = (status ?? '').toUpperCase();
  return s === 'COMPLETED' || s === 'OK' || s === 'SUCCESS';
}

function isTerminalFailure(status?: string): boolean {
  const s = (status ?? '').toUpperCase();
  return s === 'FAILED' || s === 'CANCELLED' || s === 'ERROR';
}

/**
 * Queue-based i2v (Hailuo ~minutes). Polls until completed or timeout.
 */
export async function generateFalImageToVideo(params: FalI2vParams): Promise<{
  model: string;
  durationSec: number;
}> {
  const model = params.model.trim().replace(/^\/+/, '');
  if (!model) throw new Error('FAL i2v model empty');

  const imageUrl = await uploadImageToFal(params.apiKey, params.imagePath);
  const duration = params.durationSec ?? '6';
  const timeoutMs = params.timeoutMs ?? 8 * 60_000;
  const auth = authorize(params.apiKey);

  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      prompt: params.prompt,
      image_url: imageUrl,
      duration,
      prompt_optimizer: true,
    }),
  });
  const submitText = await submitRes.text();
  if (!submitRes.ok) {
    throw new Error(`fal i2v submit failed (${submitRes.status}): ${submitText.slice(0, 280)}`);
  }

  let submitted: {
    request_id?: string;
    status_url?: string;
    response_url?: string;
    video?: { url?: string };
  };
  try {
    submitted = JSON.parse(submitText) as typeof submitted;
  } catch {
    throw new Error('fal i2v submit returned non-JSON');
  }

  // Rare sync response with video already present.
  if (submitted.video?.url?.trim()) {
    const videoUrl = submitted.video.url.trim();
    const dl = await fetch(videoUrl);
    if (!dl.ok) throw new Error(`fal i2v download failed (${dl.status})`);
    const buf = Buffer.from(await dl.arrayBuffer());
    if (!buf.length) throw new Error('Empty fal i2v download');
    await fs.mkdir(path.dirname(params.outPath), { recursive: true });
    await fs.writeFile(params.outPath, buf);
    return { model, durationSec: Number(duration) || 6 };
  }

  const requestId = submitted.request_id?.trim();
  const statusUrl =
    submitted.status_url ||
    (requestId ? `https://queue.fal.run/${model}/requests/${requestId}/status` : null);
  const responseUrl =
    submitted.response_url ||
    (requestId ? `https://queue.fal.run/${model}/requests/${requestId}` : null);

  if (!statusUrl || !responseUrl) {
    throw new Error('fal i2v submit missing status/response URLs');
  }

  const started = Date.now();
  let delay = 2500;
  while (Date.now() - started < timeoutMs) {
    const stRes = await fetch(`${statusUrl}${statusUrl.includes('?') ? '&' : '?'}logs=0`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    const stText = await stRes.text();
    if (!stRes.ok) {
      throw new Error(`fal i2v status failed (${stRes.status}): ${stText.slice(0, 200)}`);
    }
    let status: { status?: string; error?: string; response_url?: string };
    try {
      status = JSON.parse(stText) as typeof status;
    } catch {
      throw new Error('fal i2v status non-JSON');
    }

    if (isTerminalSuccess(status.status)) break;
    if (isTerminalFailure(status.status)) {
      throw new Error(`fal i2v ${status.status}: ${status.error ?? stText.slice(0, 200)}`);
    }
    await sleep(delay);
    delay = Math.min(delay + 500, 8000);
  }

  if (Date.now() - started >= timeoutMs) {
    throw new Error(`fal i2v timed out after ${Math.round(timeoutMs / 1000)}s`);
  }

  const resultRes = await fetch(responseUrl, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  const resultText = await resultRes.text();
  if (!resultRes.ok) {
    throw new Error(`fal i2v result failed (${resultRes.status}): ${resultText.slice(0, 280)}`);
  }

  let result: {
    video?: { url?: string };
    detail?: unknown;
  };
  try {
    result = JSON.parse(resultText) as typeof result;
  } catch {
    throw new Error('fal i2v result non-JSON');
  }

  const videoUrl = result.video?.url?.trim();
  if (!videoUrl) throw new Error('fal i2v result missing video.url');

  const dl = await fetch(videoUrl);
  if (!dl.ok) throw new Error(`fal i2v download failed (${dl.status})`);
  const buf = Buffer.from(await dl.arrayBuffer());
  if (!buf.length) throw new Error('Empty fal i2v download');
  await fs.mkdir(path.dirname(params.outPath), { recursive: true });
  await fs.writeFile(params.outPath, buf);

  return { model, durationSec: Number(duration) || 6 };
}

export function buildFalI2vMotionPrompt(visualPrompt: string, narration: string): string {
  const base = visualPrompt.trim() || narration.trim().slice(0, 200);
  return (
    `${base}. Slow cinematic camera drift, subtle natural motion, ` +
    `documentary style, photorealistic, no text, no watermark, no people talking`
  ).slice(0, 1500);
}
