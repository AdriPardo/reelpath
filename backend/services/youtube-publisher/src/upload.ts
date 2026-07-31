import fs from 'node:fs';
import { google } from 'googleapis';
import { clampYouTubeTitle } from '@autotube/shared';
import type { ResolvedYouTubeCredentials } from './credentials.js';
import { createYouTubeOAuthFromCredentials, formatYouTubeAuthError } from './auth.js';

function createYouTubeClient(creds: ResolvedYouTubeCredentials) {
  const oauth2 = createYouTubeOAuthFromCredentials(creds);
  return google.youtube({ version: 'v3', auth: oauth2 });
}

/** Asegura que un vídeo ya subido tenga la visibilidad configurada (p. ej. público tras aprobar). */
export async function setYouTubeVideoPrivacy(
  youtubeVideoId: string,
  privacyStatus: 'public' | 'unlisted' | 'private',
  creds: ResolvedYouTubeCredentials,
): Promise<void> {
  const youtube = createYouTubeClient(creds);
  try {
    await youtube.videos.update({
      part: ['status'],
      requestBody: {
        id: youtubeVideoId,
        status: { privacyStatus, selfDeclaredMadeForKids: false },
      },
    });
  } catch (err) {
    throw formatYouTubeAuthError(err);
  }
  console.info(`[youtube] Privacy set to ${privacyStatus}: https://youtube.com/watch?v=${youtubeVideoId}`);
}

export async function uploadToYouTubeApi(
  video: {
    filePath: string;
    title: string;
    description: string;
    tags: string[];
    /** Si se indica y es futura, el vídeo se sube en 'private' y se publica automáticamente en esa fecha. */
    publishAt?: Date;
  },
  creds: ResolvedYouTubeCredentials,
): Promise<string> {
  const youtube = createYouTubeClient(creds);

  const scheduled = video.publishAt && video.publishAt.getTime() > Date.now() ? video.publishAt : null;

  console.info(
    `[youtube] Uploading: ${video.title} (${video.filePath})` +
      (scheduled ? ` [scheduled for ${scheduled.toISOString()}]` : ''),
  );

  // YouTube exige privacyStatus 'private' cuando se usa status.publishAt (publicación programada).
  const status = scheduled
    ? {
        privacyStatus: 'private',
        publishAt: scheduled.toISOString(),
        selfDeclaredMadeForKids: false,
      }
    : {
        privacyStatus: creds.privacyStatus,
        selfDeclaredMadeForKids: false,
      };

  let response;
  try {
    response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: clampYouTubeTitle(video.title),
          description: video.description,
          tags: video.tags,
          categoryId: '27',
          defaultLanguage: 'es',
        },
        status,
      },
      media: {
        body: fs.createReadStream(video.filePath),
      },
    });
  } catch (err) {
    throw formatYouTubeAuthError(err);
  }

  const id = response.data.id;
  if (!id) throw new Error('YouTube API did not return a video ID');

  console.info(
    scheduled
      ? `[youtube] Scheduled for ${scheduled.toISOString()}: https://youtube.com/watch?v=${id}`
      : `[youtube] Published: https://youtube.com/watch?v=${id}`,
  );
  return id;
}

export async function uploadThumbnailToYouTubeApi(
  params: {
    youtubeVideoId: string;
    filePath: string;
  },
  creds: ResolvedYouTubeCredentials,
): Promise<void> {
  const youtube = createYouTubeClient(creds);

  console.info(`[youtube] Setting thumbnail for ${params.youtubeVideoId} (${params.filePath})`);

  try {
    await youtube.thumbnails.set({
      videoId: params.youtubeVideoId,
      media: {
        body: fs.createReadStream(params.filePath),
      },
    });
  } catch (err) {
    throw formatYouTubeAuthError(err);
  }

  console.info(`[youtube] Thumbnail set: https://youtube.com/watch?v=${params.youtubeVideoId}`);
}
