import { Skeleton, SkeletonHeader, SkeletonStats } from '@/components/ui/Skeleton';

export default function PipelineDetailLoading() {
  return (
    <>
      <SkeletonHeader withAction />
      <SkeletonStats count={2} />
      <Skeleton style={{ height: '14rem', borderRadius: 12 }} />
      <Skeleton style={{ height: '8rem', borderRadius: 12, marginTop: '1rem' }} />
    </>
  );
}
