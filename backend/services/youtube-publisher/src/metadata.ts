import {
  clampYouTubeTitle,
  formatYouTubeShortTitle,
  YOUTUBE_TITLE_MAX_CHARS,
} from '@autotube/shared';

export {
  clampYouTubeTitle,
  formatYouTubeShortTitle,
  YOUTUBE_TITLE_MAX_CHARS,
} from '@autotube/shared';

export function formatYouTubeShortMetadata(title: string, description: string, tags: string[]) {
  const shortTitle = formatYouTubeShortTitle(title);
  const shortDescription = description.includes('#Shorts')
    ? description
    : `${description}\n\n#Shorts`;
  const shortTags = tags.includes('Shorts') ? tags : [...tags, 'Shorts'];
  return { title: shortTitle, description: shortDescription, tags: shortTags };
}
