import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  effectiveCoverrApiKey,
  effectivePexelsApiKey,
  effectivePixabayApiKey,
  getStoragePath,
  nextRotatedSecret,
} from '@autotube/config';
import {
  buildLanczosScaleCrop,
  buildStockSearchQuery,
  boostScoreByQueryRelevance,
  ffmpegH264EncodeArgs,
  VIDEO_RESOLUTION_LONG,
  VIDEO_RESOLUTION_SHORT,
} from '@autotube/shared';
import { runFfmpeg } from '@autotube/shared/ffmpeg-runner';
import type { VisualOrigin } from '@autotube/shared';
import { generateSceneImage } from './media-providers.js';

export type SceneVisualSource = 'image' | 'stock';
export type SceneAssetType = 'image' | 'video';
export type StockProviderName = 'pexels' | 'pixabay' | 'coverr';

export interface ResolveSceneVisualParams {
  visualPrompt: string;
  narration: string;
  imageOutPath: string;
  videoOutPath: string;
  sceneIndex: number;
  aspectRatio: '9:16' | '16:9';
  preferredSource?: SceneVisualSource;
  forceAiImages?: boolean;
  allowAiImages?: boolean;
  /** Explicit EN stock query (1–3 words). */
  stockQuery?: string;
  /** Asset IDs already used in this video — avoid repeats (MPT-inspired). */
  usedSourceIds?: Set<string>;
  /** Stock B-roll playback speed (default 1). */
  playbackSpeed?: number;
  /** Channel niche — styles AI stills (history vs corporate vs general). */
  niche?: string | null;
}

export interface StockAttribution {
  stockProvider?: StockProviderName;
  stockAssetId?: string;
  stockSourcePage?: string;
  stockCreator?: string;
}

interface StockCandidate {
  provider: StockProviderName;
  url: string;
  assetId: string;
  width?: number;
  height?: number;
  score: number;
  sourcePage?: string;
  creator?: string;
}

const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Strip credentials / query tokens from public URLs before logging or caching. */
export function safePublicUrl(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    if (u.username || u.password) return undefined;
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return undefined;
  }
}

export function redactSecret(message: string, secrets: Array<string | undefined | null>): string {
  let out = message;
  for (const secret of secrets) {
    const s = secret?.trim();
    if (!s || s.length < 4) continue;
    out = out.split(s).join('[REDACTED]');
  }
  return out;
}

function isCloudflareChallenge(res: Response, bodyPreview: string): boolean {
  const mitigated = res.headers.get('cf-mitigated')?.toLowerCase();
  if (mitigated === 'challenge') return true;
  const ct = res.headers.get('content-type')?.toLowerCase() ?? '';
  if (!ct.includes('text/html')) return false;
  const lower = bodyPreview.toLowerCase();
  return lower.includes('just a moment') || lower.includes('/cdn-cgi/challenge-platform/');
}

function rotatedPexelsKey(): string | undefined {
  return nextRotatedSecret('pexels', effectivePexelsApiKey());
}

function rotatedPixabayKey(): string | undefined {
  return nextRotatedSecret('pixabay', effectivePixabayApiKey());
}

function rotatedCoverrKey(): string | undefined {
  return nextRotatedSecret('coverr', effectiveCoverrApiKey());
}

function targetResolution(aspectRatio: '9:16' | '16:9'): { width: number; height: number } {
  return aspectRatio === '9:16' ? { ...VIDEO_RESOLUTION_SHORT } : { ...VIDEO_RESOLUTION_LONG };
}

function matchesAspect(
  width: number | undefined,
  height: number | undefined,
  aspectRatio: '9:16' | '16:9',
): boolean {
  if (!width || !height || width <= 0 || height <= 0) return false;
  if (aspectRatio === '9:16') return height > width;
  return width > height;
}

function cacheKey(provider: string, query: string, aspectRatio: string): string {
  return crypto
    .createHash('sha256')
    .update(`${provider}|${query.toLowerCase()}|${aspectRatio}`)
    .digest('hex');
}

async function readSearchCache(key: string): Promise<StockCandidate[] | null> {
  const filePath = getStoragePath('cache', 'stock-search', `${key}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as { savedAt: number; items: StockCandidate[] };
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > SEARCH_CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

async function writeSearchCache(key: string, items: StockCandidate[]): Promise<void> {
  const dir = getStoragePath('cache', 'stock-search');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${key}.json`);
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ savedAt: Date.now(), items }), 'utf-8');
  await fs.rename(tmp, filePath);
}

async function fetchPexelsVideoCandidates(
  query: string,
  aspectRatio: '9:16' | '16:9',
): Promise<StockCandidate[]> {
  const apiKey = rotatedPexelsKey();
  if (!apiKey) return [];

  const orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape';
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query || 'documentary');
  url.searchParams.set('per_page', '8');
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('size', 'medium');

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) {
    console.warn(
      `[stock-provider] Pexels Videos error ${res.status}`,
      redactSecret(res.statusText, [apiKey]),
    );
    return [];
  }

  const json = (await res.json()) as {
    videos?: Array<{
      id?: number | string;
      url?: string;
      user?: { name?: string };
      video_files?: Array<{
        link?: string;
        file_type?: string;
        width?: number;
        height?: number;
        quality?: string;
      }>;
    }>;
  };

  const { width: targetW, height: targetH } = targetResolution(aspectRatio);
  const minHeight = 720;
  const out: StockCandidate[] = [];

  for (const video of json.videos ?? []) {
    const assetId = video.id != null ? `pexels:${video.id}` : '';
    for (const file of video.video_files ?? []) {
      if (file.file_type !== 'video/mp4' || !file.link || !file.width || !file.height) continue;
      if (file.height < minHeight) continue;
      if (!matchesAspect(file.width, file.height, aspectRatio)) continue;

      const overscale =
        file.width > targetW * 1.5 || file.height > targetH * 1.5 ? 0.85 : 1;
      const sizeScore = Math.min(file.width, targetW) * Math.min(file.height, targetH);
      const qualityBonus = file.quality === 'hd' ? 1.1 : 1;
      out.push({
        provider: 'pexels',
        url: file.link,
        assetId: assetId || `pexels:${file.link}`,
        width: file.width,
        height: file.height,
        score: sizeScore * overscale * qualityBonus,
        sourcePage: safePublicUrl(video.url),
        creator: video.user?.name?.trim() || undefined,
      });
      break;
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

async function fetchPixabayVideoCandidates(
  query: string,
  aspectRatio: '9:16' | '16:9',
): Promise<StockCandidate[]> {
  const apiKey = rotatedPixabayKey();
  if (!apiKey) return [];

  const { width: targetW } = targetResolution(aspectRatio);
  const url = new URL('https://pixabay.com/api/videos/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query || 'documentary');
  url.searchParams.set('video_type', 'all');
  url.searchParams.set('per_page', '20');

  const res = await fetch(url.toString());
  const bodyPreview = await res.clone().text().catch(() => '');
  if (isCloudflareChallenge(res, bodyPreview)) {
    console.error(
      '[stock-provider] Pixabay blocked by Cloudflare challenge — skip provider this run',
    );
    return [];
  }
  if (!res.ok) {
    console.warn(
      `[stock-provider] Pixabay Videos error ${res.status}`,
      redactSecret(res.statusText, [apiKey]),
    );
    return [];
  }

  let json: {
    hits?: Array<{
      id?: number | string;
      pageURL?: string;
      user?: string;
      videos?: Record<string, { url?: string; width?: number; height?: number }>;
    }>;
  };
  try {
    json = JSON.parse(bodyPreview) as typeof json;
  } catch {
    console.warn('[stock-provider] Pixabay returned non-JSON');
    return [];
  }

  const out: StockCandidate[] = [];
  for (const hit of json.hits ?? []) {
    const files = hit.videos ?? {};
    // Prefer larger renditions first.
    for (const key of ['large', 'medium', 'small', 'tiny']) {
      const file = files[key];
      if (!file?.url || !file.width || !file.height) continue;
      if (!matchesAspect(file.width, file.height, aspectRatio)) continue;
      if (file.width < Math.min(720, targetW * 0.5)) continue;
      out.push({
        provider: 'pixabay',
        url: file.url,
        assetId: hit.id != null ? `pixabay:${hit.id}` : `pixabay:${file.url}`,
        width: file.width,
        height: file.height,
        score: file.width * file.height,
        sourcePage: safePublicUrl(hit.pageURL),
        creator: hit.user?.trim() || undefined,
      });
      break;
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

async function fetchCoverrVideoCandidates(
  query: string,
  aspectRatio: '9:16' | '16:9',
): Promise<StockCandidate[]> {
  const apiKey = rotatedCoverrKey();
  if (!apiKey) return [];

  const url = new URL('https://api.coverr.co/videos');
  url.searchParams.set('query', query || 'documentary');
  url.searchParams.set('page_size', '20');
  url.searchParams.set('urls', 'true');
  url.searchParams.set('sort', 'popular');
  if (aspectRatio === '9:16') url.searchParams.set('filter', 'is_vertical:true');
  else url.searchParams.set('filter', 'is_vertical:false');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.warn(
      `[stock-provider] Coverr Videos error ${res.status}`,
      redactSecret(res.statusText, [apiKey]),
    );
    return [];
  }

  const json = (await res.json()) as {
    hits?: Array<{
      id?: string;
      max_width?: number;
      max_height?: number;
      is_vertical?: boolean;
      canonical_url?: string;
      url?: string;
      creator?: { name?: string } | string;
      author?: { name?: string } | string;
      urls?: { mp4_download?: string };
    }>;
  };

  const out: StockCandidate[] = [];
  for (const hit of json.hits ?? []) {
    const download = hit.urls?.mp4_download;
    if (!hit.id || !download) continue;

    const aspectOk = matchesAspect(hit.max_width, hit.max_height, aspectRatio);
    const verticalHintOk =
      typeof hit.is_vertical === 'boolean'
        ? aspectRatio === '9:16'
          ? hit.is_vertical
          : !hit.is_vertical
        : false;

    if (!aspectOk && !verticalHintOk) continue;

    const creatorRaw = hit.creator ?? hit.author;
    const creator =
      typeof creatorRaw === 'string'
        ? creatorRaw.trim()
        : creatorRaw && typeof creatorRaw === 'object'
          ? creatorRaw.name?.trim()
          : undefined;

    out.push({
      provider: 'coverr',
      url: download,
      assetId: `coverr:${hit.id}`,
      width: hit.max_width,
      height: hit.max_height,
      score: (hit.max_width ?? 0) * (hit.max_height ?? 0),
      sourcePage: safePublicUrl(hit.canonical_url || hit.url),
      creator: creator || undefined,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

async function searchVideosCached(
  provider: StockProviderName,
  query: string,
  aspectRatio: '9:16' | '16:9',
  fetcher: () => Promise<StockCandidate[]>,
): Promise<StockCandidate[]> {
  const key = cacheKey(provider, query, aspectRatio);
  const cached = await readSearchCache(key);
  if (cached) {
    return cached
      .map((c) => ({
        ...c,
        score: boostScoreByQueryRelevance(
          c.score,
          query,
          [c.creator, c.assetId, c.sourcePage].filter(Boolean).join(' '),
        ),
      }))
      .sort((a, b) => b.score - a.score);
  }
  const items = await fetcher();
  const ranked = items
    .map((c) => ({
      ...c,
      score: boostScoreByQueryRelevance(
        c.score,
        query,
        [c.creator, c.assetId, c.sourcePage].filter(Boolean).join(' '),
      ),
    }))
    .sort((a, b) => b.score - a.score);
  if (ranked.length > 0) {
    await writeSearchCache(key, ranked).catch((err) => {
      console.warn('[stock-provider] cache write failed:', err instanceof Error ? err.message : err);
    });
  }
  return ranked;
}

/** Prefer unused sources first (MPT `_prioritize_unique_source_clips` idea). */
function pickUniqueCandidate(
  candidates: StockCandidate[],
  usedSourceIds?: Set<string>,
): StockCandidate | null {
  if (candidates.length === 0) return null;
  const fresh = usedSourceIds
    ? candidates.filter((c) => !usedSourceIds.has(c.assetId))
    : candidates;
  return (fresh[0] ?? candidates[0]) ?? null;
}

async function fetchPexelsImage(
  query: string,
  aspectRatio: '9:16' | '16:9',
): Promise<string | null> {
  const apiKey = rotatedPexelsKey();
  if (!apiKey) return null;

  const orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape';
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query || 'documentary');
  url.searchParams.set('per_page', '1');
  url.searchParams.set('orientation', orientation);

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    console.warn(`[stock-provider] Pexels Photos error ${res.status}`);
    return null;
  }

  const json = (await res.json()) as {
    photos?: Array<{ src?: { large2x?: string; large?: string; original?: string } }>;
  };
  const photo = json.photos?.[0];
  return photo?.src?.large2x ?? photo?.src?.large ?? photo?.src?.original ?? null;
}

async function downloadToFile(fileUrl: string, outPath: string): Promise<void> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buffer);
}

async function normalizeVideoClip(
  inputPath: string,
  outPath: string,
  aspectRatio: '9:16' | '16:9',
  playbackSpeed = 1,
): Promise<void> {
  const { width, height } = targetResolution(aspectRatio);
  const scaleCrop = buildLanczosScaleCrop(width, height);
  const speed = Math.min(1.5, Math.max(0.75, playbackSpeed || 1));
  const setpts = speed === 1 ? null : `setpts=PTS/${speed}`;
  const vf = setpts ? `${scaleCrop},${setpts},fps=30` : `${scaleCrop},fps=30`;

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await runFfmpeg([
    '-i',
    inputPath,
    '-an',
    '-vf',
    vf,
    ...ffmpegH264EncodeArgs({ videoOnly: true }),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-y',
    outPath,
  ]);
}

async function tryDownloadStockVideo(
  candidate: StockCandidate,
  params: ResolveSceneVisualParams,
  query: string,
): Promise<{
  path: string;
  assetId: string;
  provider: StockProviderName;
  attribution: StockAttribution;
} | null> {
  const rawPath = params.videoOutPath.replace(/\.mp4$/, '-raw.mp4');
  try {
    await downloadToFile(candidate.url, rawPath);
    await normalizeVideoClip(
      rawPath,
      params.videoOutPath,
      params.aspectRatio,
      params.playbackSpeed ?? 1,
    );
    await fs.unlink(rawPath).catch(() => {});
    console.info(
      `[stock-provider] scene=${params.sceneIndex} ${candidate.provider} VIDEO OK query="${query}" id=${candidate.assetId}`,
    );
    return {
      path: params.videoOutPath,
      assetId: candidate.assetId,
      provider: candidate.provider,
      attribution: {
        stockProvider: candidate.provider,
        stockAssetId: candidate.assetId,
        stockSourcePage: candidate.sourcePage,
        stockCreator: candidate.creator,
      },
    };
  } catch (err) {
    console.warn(
      `[stock-provider] scene=${params.sceneIndex} fallo vídeo ${candidate.provider}:`,
      redactSecret(err instanceof Error ? err.message : String(err), [
        effectivePexelsApiKey(),
        effectivePixabayApiKey(),
        effectiveCoverrApiKey(),
      ]),
    );
    await fs.unlink(rawPath).catch(() => {});
    await fs.unlink(params.videoOutPath).catch(() => {});
    return null;
  }
}

/**
 * Resuelve el visual de una escena.
 * Stock: Pexels → Pixabay → Coverr (con cache 24h + dedup de fuentes).
 */
export async function resolveSceneVisual(params: ResolveSceneVisualParams): Promise<{
  path: string;
  source: SceneVisualSource;
  assetType: SceneAssetType;
  visualOrigin: VisualOrigin;
  stockAssetId?: string;
  stockProvider?: StockProviderName;
  attribution?: StockAttribution;
}> {
  if (params.preferredSource === 'stock') {
    const query = buildStockSearchQuery({
      stockQuery: params.stockQuery,
      visualPrompt: params.visualPrompt,
      narration: params.narration,
    });

    const hasAnyKey =
      !!effectivePexelsApiKey()?.trim() ||
      !!effectivePixabayApiKey()?.trim() ||
      !!effectiveCoverrApiKey()?.trim();

    if (!hasAnyKey) {
      console.info(
        `[stock-provider] scene=${params.sceneIndex} sin API stock (Pexels/Pixabay/Coverr); fallback a imagen IA`,
      );
    }

    const providerFetchers: Array<{
      name: StockProviderName;
      fetch: () => Promise<StockCandidate[]>;
    }> = [
      {
        name: 'pexels',
        fetch: () => fetchPexelsVideoCandidates(query, params.aspectRatio),
      },
      {
        name: 'pixabay',
        fetch: () => fetchPixabayVideoCandidates(query, params.aspectRatio),
      },
      {
        name: 'coverr',
        fetch: () => fetchCoverrVideoCandidates(query, params.aspectRatio),
      },
    ];

    for (const { name, fetch } of providerFetchers) {
      const candidates = await searchVideosCached(name, query, params.aspectRatio, fetch);
      const picked = pickUniqueCandidate(candidates, params.usedSourceIds);
      if (!picked) continue;
      const downloaded = await tryDownloadStockVideo(picked, params, query);
      if (downloaded) {
        params.usedSourceIds?.add(downloaded.assetId);
        return {
          path: downloaded.path,
          source: 'stock',
          assetType: 'video',
          visualOrigin: 'stock',
          stockAssetId: downloaded.assetId,
          stockProvider: downloaded.provider,
          attribution: downloaded.attribution,
        };
      }
    }

    const imageUrl = await fetchPexelsImage(query, params.aspectRatio);
    if (imageUrl) {
      try {
        await downloadToFile(imageUrl, params.imageOutPath);
        console.info(
          `[stock-provider] scene=${params.sceneIndex} Pexels PHOTO fallback query="${query}"`,
        );
        return {
          path: params.imageOutPath,
          source: 'stock',
          assetType: 'image',
          visualOrigin: 'stock',
        };
      } catch (err) {
        console.warn(
          `[stock-provider] scene=${params.sceneIndex} fallo foto Pexels:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.info(
      `[stock-provider] scene=${params.sceneIndex} sin stock; fallback a imagen IA`,
    );
  }

  const imageResult = await generateSceneImage({
    visualPrompt: params.visualPrompt,
    narration: params.narration,
    outPath: params.imageOutPath,
    sceneIndex: params.sceneIndex,
    aspectRatio: params.aspectRatio,
    forceAiImages: params.forceAiImages,
    allowAiImages: params.allowAiImages,
    niche: params.niche,
  });

  return {
    path: params.imageOutPath,
    source: 'image',
    assetType: 'image',
    visualOrigin: imageResult.visualOrigin,
  };
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
