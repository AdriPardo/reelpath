'use client';

import { useState } from 'react';
import { videoStreamUrl, videoThumbnailUrl } from '@/lib/api';

interface VideoThumbnailProps {
  videoId: string;
  title: string;
  aspectRatio?: string;
  hasThumbnail?: boolean;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

export function VideoThumbnail({
  videoId,
  title,
  aspectRatio = '9:16',
  hasThumbnail = true,
}: VideoThumbnailProps) {
  const [playing, setPlaying] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const isShorts = aspectRatio === '9:16';

  if (playing) {
    return (
      <div className={`video-player-shell ${isShorts ? 'video-player-shorts' : 'video-player-long'}`}>
        <video
          className="video-player-video"
          controls
          autoPlay
          preload="metadata"
          playsInline
          src={videoStreamUrl(videoId)}
          title={title}
        >
          Tu navegador no soporta la reproducción de vídeo.
        </video>
      </div>
    );
  }

  const showPoster = hasThumbnail && !thumbError;

  return (
    <button
      type="button"
      className={`video-thumbnail ${isShorts ? 'video-thumbnail-shorts' : 'video-thumbnail-long'}`}
      onClick={() => setPlaying(true)}
      aria-label={`Reproducir ${title}`}
    >
      {showPoster && !thumbLoaded ? <span className="video-thumbnail-skeleton" aria-hidden="true" /> : null}
      {showPoster ? (
        <img
          src={videoThumbnailUrl(videoId)}
          alt={title}
          className="video-thumbnail-img"
          loading="lazy"
          onLoad={() => setThumbLoaded(true)}
          onError={() => setThumbError(true)}
        />
      ) : (
        <div className="video-thumbnail-fallback" />
      )}
      <span className="video-thumbnail-play" aria-hidden>
        <span className="video-thumbnail-play-icon">
          <PlayIcon />
        </span>
      </span>
    </button>
  );
}
