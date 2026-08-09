import {
  clampYouTubeTitle,
  formatYouTubeShortTitle,
  finalizeSocialMetadata,
  YOUTUBE_TITLE_MAX_CHARS,
} from '@autotube/shared';

export {
  clampYouTubeTitle,
  formatYouTubeShortTitle,
  YOUTUBE_TITLE_MAX_CHARS,
} from '@autotube/shared';

export function formatYouTubeShortMetadata(title: string, description: string, tags: string[]) {
  const social = finalizeSocialMetadata({
    platform: 'youtube_shorts',
    title,
    caption: description,
    hashtags: tags.map((t) => (t.startsWith('#') ? t : `#${t}`)),
    fallbackSubject: title,
    fallbackScript: description,
    fallbackTags: tags,
  });

  const shortTitle = formatYouTubeShortTitle(social.title.replace(/\s*#Shorts\s*$/i, '').trim());
  const shortDescription = social.caption.includes('#Shorts')
    ? social.caption
    : `${social.caption}\n\n#Shorts`;
  const shortTags = Array.from(
    new Set([
      ...tags,
      ...social.hashtags.map((h) => h.replace(/^#/, '')),
      'Shorts',
    ]),
  );
  return { title: shortTitle, description: shortDescription, tags: shortTags };
}

/** Multi-platform caption pack for future cross-post (TikTok/IG/FB). */
export function buildCrossPostMetadata(params: {
  title: string;
  description: string;
  tags: string[];
  scriptExcerpt?: string;
}) {
  const platforms = ['youtube', 'youtube_shorts', 'tiktok', 'instagram_reels'] as const;
  return Object.fromEntries(
    platforms.map((platform) => [
      platform,
      finalizeSocialMetadata({
        platform,
        title: params.title,
        caption: params.description,
        hashtags: params.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)),
        fallbackSubject: params.title,
        fallbackScript: params.scriptExcerpt ?? params.description,
        fallbackTags: params.tags,
      }),
    ]),
  );
}
