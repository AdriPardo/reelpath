'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { videoStreamUrl, videoThumbnailUrl } from '@/lib/api';
import { formatDurationCompact } from '@/lib/format-duration';

interface VideoPlayerProps {
  videoId: string;
  title: string;
  aspectRatio?: string;
  hasLocalFile?: boolean;
  youtubeVideoId?: string | null;
  durationSec?: number;
  hasThumbnail?: boolean;
}

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

export function VideoPlayer({
  videoId,
  title,
  aspectRatio = '9:16',
  hasLocalFile = true,
  youtubeVideoId,
  durationSec,
  hasThumbnail = true,
}: VideoPlayerProps) {
  const t = useTranslations('videos.player');
  const isShorts = aspectRatio === '9:16';
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec ?? 0);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2800);
    }
  }, [playing]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  const handleStart = () => {
    setStarted(true);
    setLoading(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!started || error) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'f') {
      e.preventDefault();
      void containerRef.current?.requestFullscreen?.();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const el = videoRef.current;
      if (el) el.currentTime = Math.min(el.duration, el.currentTime + 5);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const el = videoRef.current;
      if (el) el.currentTime = Math.max(0, el.currentTime - 5);
    }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (videoRef.current) videoRef.current.playbackRate = SPEEDS[next];
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const val = Number(e.target.value);
    el.currentTime = val;
    setCurrentTime(val);
  };

  if (!hasLocalFile || error) {
    const youtubeUrl = youtubeVideoId && !youtubeVideoId.startsWith('mock_')
      ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
      : null;

    return (
      <div
        className={`video-player-shell video-player-unavailable ${isShorts ? 'video-player-shorts' : 'video-player-long'}`}
      >
        <div className="video-player-empty">
          <span className="video-player-empty-icon" aria-hidden>
            {error ? '⚠' : '📁'}
          </span>
          <p>
            {error ? t('loadErrorApi') : t('localDeleted')}
          </p>
          {youtubeUrl && (
            <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              {t('viewYoutube')}
            </a>
          )}
        </div>
      </div>
    );
  }

  const showPoster = !started && hasThumbnail && !thumbError;
  const progressMax = duration > 0 ? duration : 100;
  const progressVal = duration > 0 ? currentTime : 0;

  return (
    <div
      ref={containerRef}
      className={`video-player-shell ${isShorts ? 'video-player-shorts' : 'video-player-long'}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {showPoster ? (
        <button
          type="button"
          className="video-player-poster"
          onClick={handleStart}
          aria-label={t('playAria', { title })}
        >
          <img
            src={videoThumbnailUrl(videoId)}
            alt=""
            className="video-player-poster-img"
            onError={() => setThumbError(true)}
          />
          <span className="video-player-poster-play" aria-hidden>
            ▶
          </span>
          {durationSec != null && durationSec > 0 && (
            <span className="video-player-duration-badge">{formatDurationCompact(durationSec)}</span>
          )}
        </button>
      ) : (
        <>
          <video
            ref={videoRef}
            className="video-player-video"
            preload="metadata"
            playsInline
            src={videoStreamUrl(videoId)}
            title={title}
            onClick={togglePlay}
            onPlay={() => {
              setPlaying(true);
              setLoading(false);
              resetHideTimer();
            }}
            onPause={() => {
              setPlaying(false);
              setShowControls(true);
            }}
            onWaiting={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onError={() => setError(true)}
            autoPlay={started}
          />

          {loading && (
            <div className="video-player-loading" aria-live="polite">
              <span className="video-player-spinner" />
            </div>
          )}

          <div className={`video-player-controls${showControls || !playing ? ' video-player-controls-visible' : ''}`}>
            <input
              type="range"
              className="video-player-seek"
              min={0}
              max={progressMax}
              step={0.1}
              value={progressVal}
              onChange={handleSeek}
              aria-label={t('positionAria')}
            />
            <div className="video-player-controls-row">
              <button type="button" className="video-player-ctrl-btn" onClick={togglePlay} aria-label={playing ? t('pause') : t('play')}>
                {playing ? '⏸' : '▶'}
              </button>
              <span className="video-player-time">
                {formatDurationCompact(currentTime)} / {formatDurationCompact(duration)}
              </span>
              <div className="video-player-controls-spacer" />
              <button type="button" className="video-player-ctrl-btn video-player-speed" onClick={cycleSpeed} title={t('speed')}>
                {SPEEDS[speedIdx]}×
              </button>
              <button
                type="button"
                className="video-player-ctrl-btn"
                onClick={() => void videoRef.current?.requestPictureInPicture?.()}
                title="Picture-in-Picture"
                aria-label="Picture in Picture"
              >
                ⧉
              </button>
              <button
                type="button"
                className="video-player-ctrl-btn"
                onClick={() => void containerRef.current?.requestFullscreen?.()}
                title={t('fullscreenHint')}
                aria-label={t('fullscreen')}
              >
                ⛶
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
