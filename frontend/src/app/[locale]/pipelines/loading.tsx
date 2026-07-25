import { SkeletonGrid, SkeletonHeader, SkeletonStats, SkeletonTable } from '@/components/ui/Skeleton';

export default function PipelinesLoading() {
  return (
    <>
      <SkeletonHeader withAction />
      <SkeletonStats count={3} />
      <SkeletonTable rows={6} />
    </>
  );
}
