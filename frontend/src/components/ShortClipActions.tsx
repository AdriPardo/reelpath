'use client';

import { useState } from 'react';
import { clipStreamUrl, clipThumbnailUrl } from '@/lib/api';
import type { VideoClip } from '@/lib/clips';

export function ShortClipActions({ videoId, clip }: { videoId: string; clip: VideoClip }) {
  const [playing, setPlaying] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const streamUrl = clipStreamUrl(videoId, clip.id);
  const thumbUrl = clipThumbnailUrl(videoId, clip.id);
  const hasThumb = !!clip.thumbnailPath && !thumbError;

  return (
    <div className="clip-actions">
      {playing ? (
        <video
          className="clip-preview"
          src={streamUrl}
          controls
          autoPlay
          preload="metadata"
          playsInline
        />
      ) : (
        <button
          type="button"
          className="clip-thumbnail"
          onClick={() => setPlaying(true)}
          aria-label={`Reproducir Short ${clip.partIndex + 1}`}
        >
          {hasThumb ? (
            <img
              src={thumbUrl}
              alt={clip.title}
              className="clip-thumbnail-img"
              onError={() => setThumbError(true)}
            />
          ) : (
            <div className="clip-thumbnail-fallback" />
          )}
          <span className="clip-thumbnail-play" aria-hidden>▶</span>
        </button>
      )}
      <div className="clip-actions-row">
        <a className="btn btn-primary btn-sm" href={streamUrl} download={`short-${clip.partIndex + 1}.mp4`}>
          Descargar
        </a>
        {hasThumb && (
          <a className="btn btn-sm" href={thumbUrl} download={`short-${clip.partIndex + 1}-thumb.jpg`}>
            Miniatura
          </a>
        )}
      </div>
    </div>
  );
}
