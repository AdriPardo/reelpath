import { SkeletonGrid, SkeletonHeader } from '@/components/ui/Skeleton';

export default function ChannelsLoading() {
  return (
    <div className="page-content">
      <SkeletonHeader />
      <SkeletonGrid count={3} className="channels-grid" />
    </div>
  );
}
