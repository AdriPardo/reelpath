import fs from 'node:fs/promises';
import { loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import {
  resolveYouTubeCredentialsForChannel,
  type ResolvedYouTubeCredentials,
} from './credentials.js';
import { uploadThumbnailToYouTubeApi, uploadToYouTubeApi, setYouTubeVideoPrivacy } from './upload.js';
import { formatYouTubeShortMetadata } from './metadata.js';
import { publishYouTubeShortsClips } from './shorts.js';

export { uploadThumbnailToYouTubeApi, setYouTubeVideoPrivacy, deleteYouTubeVideoApi } from './upload.js';
export {
  hasYouTubeCredentials,
  createYouTubeOAuth,
  createYouTubeOAuthFromCredentials,
  canUseRealYouTube,
  formatYouTubeAuthError,
} from './auth.js';
export {
  resolveYouTubeCredentialsForChannel,
  hasYouTubeCredentialsForChannel,
  type ResolvedYouTubeCredentials,
} from './credentials.js';
export {
  clampYouTubeTitle,
  formatYouTubeShortTitle,
  formatYouTubeShortMetadata,
  buildCrossPostMetadata,
  YOUTUBE_TITLE_MAX_CHARS,
} from './metadata.js';
export { publishYouTubeShortsClips } from './shorts.js';
export type { YouTubeShortsPublishSummary } from './shorts.js';
export {
  crossPostVideoViaUploadPost,
  checkUploadPostStatus,
  isUploadPostConfigured,
  type CrossPostResult,
  type UploadPostPlatform,
} from './upload-post.js';

async function tryUploadThumbnail(
  youtubeVideoId: string,
  thumbnailPath: string | null,
  creds: ResolvedYouTubeCredentials,
): Promise<void> {
  if (!thumbnailPath) return;

  try {
    await fs.access(thumbnailPath);
  } catch {
    console.warn(`[youtube] Thumbnail file missing: ${thumbnailPath}`);
    return;
  }

  try {
    await uploadThumbnailToYouTubeApi({ youtubeVideoId, filePath: thumbnailPath }, creds);
  } catch (err) {
    console.warn('[youtube] Thumbnail upload failed:', err instanceof Error ? err.message : err);
  }
}

export interface PublishResult {
  youtubeVideoId: string;
  publishedAt: Date;
  mock: boolean;
  scheduled?: boolean;
  url?: string;
}

function resolveFutureSchedule(scheduledPublishAt: Date | null | undefined): Date | null {
  if (!scheduledPublishAt) return null;
  return scheduledPublishAt.getTime() > Date.now() ? scheduledPublishAt : null;
}

export async function publishToYouTube(videoId: string): Promise<PublishResult> {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  const config = loadConfig();
  const creds = await resolveYouTubeCredentialsForChannel(video.channelId);
  const canUploadReal = !config.MOCK_EXTERNAL_APIS && creds !== null;
  const isNativeShort = video.format === 'shorts';
  const scheduledAt = resolveFutureSchedule(video.scheduledPublishAt);

  if (video.reviewStatus !== 'approved' && video.reviewStatus !== 'published' && video.reviewStatus !== 'scheduled') {
    throw new Error(`Video ${videoId} is not approved for publishing`);
  }

  if (!canUploadReal && !config.MOCK_EXTERNAL_APIS) {
    throw new Error(
      'YouTube no está conectado para este canal. Ve a Integraciones del canal y conecta YouTube.',
    );
  }

  if (video.youtubeVideoId) {
    const wasMock = video.youtubeVideoId.startsWith('mock_');

    if (video.reviewStatus === 'scheduled' && scheduledAt) {
      return {
        youtubeVideoId: video.youtubeVideoId,
        publishedAt: scheduledAt,
        mock: wasMock || !canUploadReal,
        scheduled: true,
        url: wasMock ? undefined : `https://youtube.com/watch?v=${video.youtubeVideoId}`,
      };
    }

    if (video.publishedAt) {
      if (!wasMock && creds) {
        await setYouTubeVideoPrivacy(video.youtubeVideoId, creds.privacyStatus, creds);
        await tryUploadThumbnail(video.youtubeVideoId, video.thumbnailPath, creds);
        return {
          youtubeVideoId: video.youtubeVideoId,
          publishedAt: video.publishedAt,
          mock: false,
          url: `https://youtube.com/watch?v=${video.youtubeVideoId}`,
        };
      }

      if (!canUploadReal) {
        return {
          youtubeVideoId: video.youtubeVideoId,
          publishedAt: video.publishedAt,
          mock: true,
        };
      }
    }
  }

  const shortMeta = isNativeShort
    ? formatYouTubeShortMetadata(video.title, video.description, video.tags)
    : null;

  const youtubeVideoId = canUploadReal
    ? await uploadToYouTubeApi(
        {
          filePath: video.filePath,
          title: shortMeta?.title ?? video.title,
          description: shortMeta?.description ?? video.description,
          tags: shortMeta?.tags ?? video.tags,
          ...(scheduledAt ? { publishAt: scheduledAt } : {}),
        },
        creds!,
      )
    : `mock_${videoId.slice(0, 8)}`;

  if (canUploadReal && creds) {
    await tryUploadThumbnail(youtubeVideoId, video.thumbnailPath, creds);
  }

  const mock = !canUploadReal;

  if (mock) {
    console.info(
      `[youtube] Mock publish video=${videoId} id=${youtubeVideoId}` +
        (scheduledAt ? ` [scheduled for ${scheduledAt.toISOString()}]` : ''),
    );
  } else if (creds?.source === 'env') {
    console.info(`[youtube] Published using global .env fallback for channel=${video.channelId}`);
  }

  if (scheduledAt) {
    await prisma.video.update({
      where: { id: videoId },
      data: {
        youtubeVideoId,
        reviewStatus: 'scheduled',
        scheduledPublishAt: scheduledAt,
        publishedAt: null,
      },
    });

    return {
      youtubeVideoId,
      publishedAt: scheduledAt,
      mock,
      scheduled: true,
      url: mock ? undefined : `https://youtube.com/watch?v=${youtubeVideoId}`,
    };
  }

  const publishedAt = new Date();

  await prisma.video.update({
    where: { id: videoId },
    data: { youtubeVideoId, publishedAt, reviewStatus: 'published', scheduledPublishAt: null },
  });

  return {
    youtubeVideoId,
    publishedAt,
    mock,
    url: mock ? undefined : `https://youtube.com/watch?v=${youtubeVideoId}`,
  };
}
