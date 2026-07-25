import { serverApi } from '@/lib/api-server';

export interface VideoClip {
  id: string;
  partIndex: number;
  title: string;
  durationSec: number;
  platform: string;
  publishStatus: string;
  externalId: string | null;
  scheduledPublishAt?: string | null;
  publishedAt: string | null;
  error: string | null;
  thumbnailPath?: string | null;
}

export async function fetchVideoClips(videoId: string): Promise<VideoClip[]> {
  return serverApi<VideoClip[]>(`/api/videos/${videoId}/clips`);
}
