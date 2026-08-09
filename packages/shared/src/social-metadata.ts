/**
 * Social publish metadata by platform (MoneyPrinterTurbo-inspired).
 * Clamp lengths + normalize hashtags; LLM optional at call site.
 */

export type SocialPlatform =
  | 'youtube'
  | 'youtube_shorts'
  | 'tiktok'
  | 'instagram_reels'
  | 'facebook_reels';

export const SOCIAL_PLATFORM_LIMITS: Record<
  SocialPlatform,
  { titleMax: number; captionMax: number; hashtagCount: number }
> = {
  youtube: { titleMax: 100, captionMax: 5000, hashtagCount: 5 },
  youtube_shorts: { titleMax: 100, captionMax: 5000, hashtagCount: 3 },
  tiktok: { titleMax: 100, captionMax: 2200, hashtagCount: 5 },
  instagram_reels: { titleMax: 125, captionMax: 2200, hashtagCount: 8 },
  facebook_reels: { titleMax: 125, captionMax: 2200, hashtagCount: 5 },
};

export interface SocialMetadata {
  platform: SocialPlatform;
  title: string;
  caption: string;
  hashtags: string[];
}

export function normalizeHashtags(tags: string[], maxCount: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    let tag = raw.trim();
    if (!tag) continue;
    if (!tag.startsWith('#')) tag = `#${tag}`;
    tag = tag.replace(/[^\w#áéíóúñüÁÉÍÓÚÑÜ]/gi, '');
    const key = tag.toLowerCase();
    if (seen.has(key) || tag.length < 2) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= maxCount) break;
  }
  return out;
}

export function clampSocialText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Deterministic fallback without LLM (subject + first sentence + tags). */
export function buildSocialMetadataFallback(params: {
  platform: SocialPlatform;
  subject: string;
  script?: string;
  tags?: string[];
}): SocialMetadata {
  const limits = SOCIAL_PLATFORM_LIMITS[params.platform];
  const firstSentence =
    params.script
      ?.trim()
      .split(/(?<=[.!?…])\s+/)
      .find((s) => s.trim().length > 0)
      ?.trim() ?? params.subject;

  let title = clampSocialText(params.subject || firstSentence, limits.titleMax);
  if (params.platform === 'youtube_shorts' && !/#shorts/i.test(title)) {
    title = clampSocialText(`${title} #Shorts`, limits.titleMax);
  }

  const hashtags = normalizeHashtags(
    [
      ...(params.tags ?? []),
      ...(params.platform === 'youtube_shorts' ? ['Shorts'] : []),
      ...(params.platform === 'tiktok' ? ['fyp'] : []),
      ...(params.platform === 'instagram_reels' ? ['reels'] : []),
    ],
    limits.hashtagCount,
  );

  const captionBody = clampSocialText(firstSentence, limits.captionMax - 80);
  const caption = clampSocialText(
    `${captionBody}${hashtags.length ? `\n\n${hashtags.join(' ')}` : ''}`,
    limits.captionMax,
  );

  return { platform: params.platform, title, caption, hashtags };
}

/** Clamp LLM-produced social metadata into platform limits. */
export function finalizeSocialMetadata(params: {
  platform: SocialPlatform;
  title?: string;
  caption?: string;
  hashtags?: string[];
  fallbackSubject: string;
  fallbackScript?: string;
  fallbackTags?: string[];
}): SocialMetadata {
  const limits = SOCIAL_PLATFORM_LIMITS[params.platform];
  const fallback = buildSocialMetadataFallback({
    platform: params.platform,
    subject: params.fallbackSubject,
    script: params.fallbackScript,
    tags: params.fallbackTags,
  });

  const title = clampSocialText(params.title?.trim() || fallback.title, limits.titleMax);
  const hashtags = normalizeHashtags(
    [...(params.hashtags ?? []), ...fallback.hashtags],
    limits.hashtagCount,
  );
  const captionRaw = params.caption?.trim() || fallback.caption;
  const caption = clampSocialText(
    hashtags.length && !hashtags.every((h) => captionRaw.includes(h))
      ? `${captionRaw}\n\n${hashtags.join(' ')}`
      : captionRaw,
    limits.captionMax,
  );

  return { platform: params.platform, title, caption, hashtags };
}
