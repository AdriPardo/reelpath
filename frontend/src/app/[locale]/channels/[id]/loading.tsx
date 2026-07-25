import { SkeletonCard, SkeletonHeader, SkeletonTabs } from '@/components/ui/Skeleton';

export default function ChannelDetailLoading() {
  return (
    <>
      <SkeletonHeader withAction />
      <SkeletonTabs count={4} />
      <SkeletonCard lines={4} />
    </>
  );
}
