/**
 * Upload-Post API — cross-post verticals to TikTok / Instagram (and optional YT Shorts).
 * Docs: https://docs.upload-post.com
 * Pattern from MoneyPrinterTurbo `upload_post.py` (MIT).
 */
import fs from 'node:fs/promises';
import { loadConfig, getPlatformSecretsOverrides } from '@autotube/config';
import { buildSocialMetadataFallback, type SocialPlatform } from '@autotube/shared';

const API_BASE = 'https://api.upload-post.com';

export type UploadPostPlatform = 'tiktok' | 'instagram' | 'youtube';

export interface UploadPostConfig {
  apiKey: string;
  username: string;
  enabled: boolean;
  platforms: UploadPostPlatform[];
}

export interface CrossPostResult {
  success: boolean;
  skipped?: boolean;
  requestId?: string;
  error?: string;
  raw?: unknown;
}

function resolveUploadPostConfig(): UploadPostConfig {
  const cfg = loadConfig();
  const platform = getPlatformSecretsOverrides();
  const apiKey =
    platform?.uploadPostApiKey?.trim() ||
    cfg.UPLOAD_POST_API_KEY?.trim() ||
    '';
  const username =
    platform?.uploadPostUsername?.trim() ||
    cfg.UPLOAD_POST_USERNAME?.trim() ||
    '';
  const enabled =
    (platform?.uploadPostEnabled === true || cfg.UPLOAD_POST_ENABLED === true) &&
    Boolean(apiKey && username);

  const rawPlatforms =
    cfg.UPLOAD_POST_PLATFORMS?.split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean) ?? ['tiktok', 'instagram'];

  const platforms = rawPlatforms.filter(
    (p): p is UploadPostPlatform =>
      p === 'tiktok' || p === 'instagram' || p === 'youtube',
  );

  return {
    apiKey,
    username,
    enabled,
    platforms: platforms.length > 0 ? platforms : ['tiktok', 'instagram'],
  };
}

export function isUploadPostConfigured(): boolean {
  return resolveUploadPostConfig().enabled;
}

function socialPlatformFor(p: UploadPostPlatform): SocialPlatform {
  if (p === 'tiktok') return 'tiktok';
  if (p === 'instagram') return 'instagram_reels';
  return 'youtube_shorts';
}

/**
 * Upload a local video file to Upload-Post for the configured platforms.
 */
export async function crossPostVideoViaUploadPost(params: {
  videoPath: string;
  title: string;
  description?: string;
  tags?: string[];
  platforms?: UploadPostPlatform[];
}): Promise<CrossPostResult> {
  const config = resolveUploadPostConfig();
  if (!config.enabled) {
    return { success: false, skipped: true, error: 'Upload-Post not configured' };
  }

  try {
    await fs.access(params.videoPath);
  } catch {
    return { success: false, error: `Video file not found: ${params.videoPath}` };
  }

  const platforms = params.platforms?.length ? params.platforms : config.platforms;
  const meta = buildSocialMetadataFallback({
    platform: socialPlatformFor(platforms[0] ?? 'tiktok'),
    subject: params.title,
    script: params.description,
    tags: params.tags,
  });
  const title = `${meta.title} ${meta.hashtags.join(' ')}`.trim().slice(0, 2200);

  const form = new FormData();
  form.append('user', config.username);
  form.append('title', title);
  form.append('privacy_level', 'PUBLIC_TO_EVERYONE');
  for (const p of platforms) {
    form.append('platform[]', p);
  }

  const fileBuf = await fs.readFile(params.videoPath);
  form.append(
    'video',
    new Blob([new Uint8Array(fileBuf)], { type: 'video/mp4' }),
    pathBasename(params.videoPath),
  );

  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Apikey ${config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(300_000),
    });
    const raw = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      request_id?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        success: false,
        error: raw.message || `Upload-Post HTTP ${res.status}`,
        raw,
      };
    }
    return {
      success: Boolean(raw.success),
      requestId: raw.request_id,
      error: raw.success ? undefined : raw.message || 'Upload-Post failed',
      raw,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkUploadPostStatus(requestId: string): Promise<unknown> {
  const config = resolveUploadPostConfig();
  if (!config.apiKey) throw new Error('Upload-Post API key missing');
  const url = new URL(`${API_BASE}/api/uploadposts/status`);
  url.searchParams.set('request_id', requestId);
  const res = await fetch(url, {
    headers: { Authorization: `Apikey ${config.apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Upload-Post status HTTP ${res.status}`);
  return res.json();
}

function pathBasename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'video.mp4';
}
