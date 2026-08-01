import { SkeletonHeader } from '@/components/ui/Skeleton';

export default function ReviewLoading() {
  return (
    <div className="page-content">
      <SkeletonHeader />
      <div className="review-queue" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '9rem', borderRadius: 12 }} />
        ))}
      </div>
    </div>
  );
}
