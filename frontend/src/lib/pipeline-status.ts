export function isPipelineInProgress(status: string): boolean {
  return (
    status !== 'completed' &&
    status !== 'failed' &&
    status !== 'rejected' &&
    status !== 'pending_review' &&
    status !== 'cancelled'
  );
}

/** Pipeline cancelable si el vídeo aún no está publicado en YouTube. */
export function isPipelineCancellable(
  status: string,
  video?: { reviewStatus: string; youtubeVideoId?: string | null } | null,
): boolean {
  if (status === 'cancelled') return false;
  if (video?.youtubeVideoId || video?.reviewStatus === 'published') return false;
  if (status === 'failed') return false;
  if (status === 'completed') return video?.reviewStatus === 'scheduled';
  return true;
}
