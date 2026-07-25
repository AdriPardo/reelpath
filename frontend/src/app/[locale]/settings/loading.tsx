import { SkeletonHeader, SkeletonSettingsLayout } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <>
      <SkeletonHeader />
      <SkeletonSettingsLayout />
    </>
  );
}
