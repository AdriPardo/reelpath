import { Skeleton, SkeletonHeader } from '@/components/ui/Skeleton';

export default function PipelineDetailLoading() {
  return (
    <div className="page-content">
      <SkeletonHeader withAction />
      <Skeleton style={{ height: '2.5rem', width: '12rem', borderRadius: 8 }} />
      <Skeleton style={{ height: '11rem', borderRadius: 12 }} />
      <Skeleton style={{ height: '6rem', borderRadius: 12 }} />
      <Skeleton style={{ height: '8rem', borderRadius: 12 }} />
    </div>
  );
}
