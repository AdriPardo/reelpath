'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { VideoStatusBadge } from '@/components/VideoStatusBadge';
import { ChannelBadge } from '@/components/ChannelBadge';
import type { Video } from '@/lib/api';
import { formatVideoMetaLabel } from '@/lib/video-labels';
import { ButtonLink } from '@/components/ui/Button';

interface VideoCardProps {
  video: Video;
  actions?: ReactNode;
}

function formatCreatedAtShort(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCreatedAtLong(iso: string): string {
  return new Date(iso).toLocaleString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

function VideoCardMenu({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="video-card-menu" ref={menuRef}>
      <button
        type="button"
        className="video-card-menu-trigger"
        aria-label={`Opciones de ${title}`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          className="video-card-menu-dropdown"
          role="menu"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function VideoCard({ video, actions }: VideoCardProps) {
  return (
    <article className="video-card">
      <VideoThumbnail
        videoId={video.id}
        title={video.title}
        aspectRatio={video.aspectRatio}
        hasThumbnail={!!video.thumbnailPath}
      />
      <div className="video-card-body">
        {video.channel && <ChannelBadge name={video.channel.name} channelId={video.channel.id} />}
        <h3>
          <Link href={`/videos/${video.id}`} className="video-card-title-link">
            {video.title}
          </Link>
        </h3>
        <div className="video-card-meta">
          <span>{formatVideoMetaLabel(video.format, video.durationSec)}</span>
          {(video.clipCount ?? 0) > 0 && (
            <span>{video.clipCount} Short{video.clipCount === 1 ? '' : 's'}</span>
          )}
          <VideoStatusBadge
            reviewStatus={video.reviewStatus}
            scheduledPublishAt={video.scheduledPublishAt}
            publishedAt={video.publishedAt}
            youtubeVideoId={video.youtubeVideoId}
            channel={video.channel}
          />
        </div>
        <p className="video-card-date" title={formatCreatedAtLong(video.createdAt)}>
          {formatCreatedAtShort(video.createdAt)}
        </p>
        <div className="video-card-footer">
          <ButtonLink href={`/videos/${video.id}`} variant="primary" size="sm" className="video-card-primary">
            Ver detalle y clips
          </ButtonLink>
          {actions ? <VideoCardMenu title={video.title}>{actions}</VideoCardMenu> : null}
        </div>
      </div>
    </article>
  );
}
