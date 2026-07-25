import { SkeletonHeader } from '@/components/ui/Skeleton';

export default function ReviewLoading() {
  return (
    <>
      <SkeletonHeader />
      <div className="skeleton" style={{ height: '4.5rem', borderRadius: 14, marginBottom: '1rem' }} aria-hidden="true" />
      <div className="review-queue" aria-hidden="true">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '18rem', borderRadius: 14 }} />
        ))}
      </div>
    </>
  );
}
