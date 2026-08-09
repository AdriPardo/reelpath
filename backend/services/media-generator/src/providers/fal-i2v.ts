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
  const contentType = imagePath.toLowerCase().endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  const fileName = path.basename(imagePath) || 'scene.png';

  const initRes = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST',
    headers: {
      Authorization: authorize(apiKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      file_name: fileName,
      content_type: contentType,
    }),
  });
  const initText = await initRes.text();
  if (!initRes.ok) {
    // Fallback: data URI (works for smaller files).
    console.warn(
      `[fal-i2v] upload initiate failed (${initRes.status}); using data URI fallback`,
    );
    return `data:${contentType};base64,${buf.toString('base64')}`;
  }

  let initiated: { upload_url?: string; file_url?: string };
  try {
    initiated = JSON.parse(initText) as typeof initiated;
  } catch {
    return `data:${contentType};base64,${buf.toString('base64')}`;
  }

  if (!initiated.upload_url || !initiated.file_url) {
    return `data:${contentType};base64,${buf.toString('base64')}`;
  }

  const put = await fetch(initiated.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buf,
  });
  if (!put.ok) {
    throw new Error(`fal upload PUT failed (${put.status})`);
  }
  return initiated.file_url;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
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
  };
  try {
    submitted = JSON.parse(submitText) as typeof submitted;
  } catch {
    throw new Error('fal i2v submit returned non-JSON');
  }

  const statusUrl =
    submitted.status_url ||
    (submitted.request_id
      ? `https://queue.fal.run/${model}/requests/${submitted.request_id}/status`
      : null);
  const responseUrl =
    submitted.response_url ||
    (submitted.request_id
      ? `https://queue.fal.run/${model}/requests/${submitted.request_id}`
      : null);

  if (!statusUrl || !responseUrl) {
    throw new Error('fal i2v submit missing status/response URLs');
  }

  const started = Date.now();
  let delay = 2500;
  while (Date.now() - started < timeoutMs) {
    const stRes = await fetch(statusUrl, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    const stText = await stRes.text();
    if (!stRes.ok) {
      throw new Error(`fal i2v status failed (${stRes.status}): ${stText.slice(0, 200)}`);
    }
    let status: { status?: string; error?: string };
    try {
      status = JSON.parse(stText) as typeof status;
    } catch {
      throw new Error('fal i2v status non-JSON');
    }

    if (status.status === 'COMPLETED') break;
    if (status.status === 'FAILED' || status.status === 'CANCELLED') {
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
