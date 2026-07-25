import { Skeleton, SkeletonHeader, SkeletonPanel } from '@/components/ui/Skeleton';

export default function VideoDetailLoading() {
  return (
    <div className="video-detail-page" aria-busy="true">
      <SkeletonHeader withAction />
      <div className="video-detail-layout">
        <Skeleton className="skeleton-card-media" />
        <SkeletonPanel lines={6} />
      </div>
      <SkeletonPanel lines={3} />
    </div>
  );
}
