import { SkeletonHeader, SkeletonStats } from '@/components/ui/Skeleton';

export default function RootLoading() {
  return (
    <div className="page-content">
      <SkeletonHeader withAction />
      <SkeletonStats count={4} />
      <div className="skeleton" style={{ height: '5rem', borderRadius: 12 }} aria-hidden="true" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '3.25rem', borderRadius: 8 }} />
        ))}
      </div>
    </div>
  );
}
