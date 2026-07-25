import { SkeletonGrid, SkeletonHeader, SkeletonTabs } from '@/components/ui/Skeleton';

export default function VideosLoading() {
  return (
    <>
      <SkeletonHeader />
      <SkeletonTabs count={6} />
      <div className="video-search" aria-hidden="true">
        <div className="skeleton" style={{ height: '2.75rem', maxWidth: 420, flex: 1, borderRadius: 10 }} />
      </div>
      <SkeletonGrid count={6} tall />
    </>
  );
}
