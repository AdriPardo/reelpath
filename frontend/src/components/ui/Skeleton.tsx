import type { CSSProperties } from 'react';

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`skeleton${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonHeader({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="page-header">
      <div className="skeleton-header" style={{ flex: 1, marginBottom: 0 }}>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-subtitle" />
      </div>
      {withAction && <Skeleton style={{ width: '9rem', height: '2.5rem', borderRadius: 8 }} />}
    </div>
  );
}

export function SkeletonTabs({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-tabs" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-chip" />
      ))}
    </div>
  );
}

export function SkeletonCard({ tall = false, lines = 2 }: { tall?: boolean; lines?: number }) {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className={`skeleton skeleton-card-media${tall ? ' skeleton-card-media-tall' : ''}`} />
      <div className="skeleton skeleton-line" style={{ width: '80%' }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ width: i === lines - 1 ? '55%' : '95%' }} />
      ))}
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  tall = false,
  className = 'video-grid',
}: {
  count?: number;
  tall?: boolean;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} tall={tall} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      <Skeleton style={{ height: '2.5rem', borderRadius: 8, marginBottom: '0.75rem' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} style={{ height: '3rem', borderRadius: 8, marginBottom: '0.5rem' }} />
      ))}
    </div>
  );
}

export function SkeletonPanel({ lines = 4 }: { lines?: number }) {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <Skeleton style={{ width: '40%', height: '1.1rem' }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="skeleton-line" style={{ width: i === lines - 1 ? '60%' : '95%' }} />
      ))}
    </div>
  );
}

export function SkeletonSettingsLayout() {
  return (
    <div className="settings-layout" aria-hidden="true">
      <Skeleton style={{ height: '4.5rem', borderRadius: 12, marginBottom: '1.25rem' }} />
      <div className="settings-body">
        <div className="settings-nav-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} style={{ height: '2.25rem', borderRadius: 8 }} />
          ))}
        </div>
        <SkeletonPanel lines={5} />
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="skeleton-stat" />
      ))}
    </div>
  );
}
