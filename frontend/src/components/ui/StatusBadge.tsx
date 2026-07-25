'use client';

import { useTranslations } from 'next-intl';
import { Chip } from '@/components/ui/Chip';

type BadgeKind = 'review' | 'pipeline';

const REVIEW_KEYS: Record<string, string> = {
  pending: 'reviewPending',
  approved: 'reviewApproved',
  scheduled: 'reviewScheduled',
  rejected: 'reviewRejected',
  published: 'reviewPublished',
  cancelled: 'reviewCancelled',
};

const PIPELINE_KEYS: Record<string, string> = {
  scheduled: 'pipelineScheduled',
  generating_ideas: 'pipelineGeneratingIdeas',
  selecting_idea: 'pipelineSelectingIdea',
  generating_script: 'pipelineGeneratingScript',
  generating_media: 'pipelineGeneratingMedia',
  rendering_video: 'pipelineRenderingVideo',
  auto_reviewing: 'pipelineAutoReviewing',
  pending_review: 'pipelinePendingReview',
  approved: 'pipelineApproved',
  rejected: 'pipelineRejected',
  publishing: 'pipelinePublishing',
  published: 'pipelinePublished',
  syncing_analytics: 'pipelineSyncingAnalytics',
  completed: 'pipelineCompleted',
  failed: 'pipelineFailed',
  cancelled: 'pipelineCancelled',
};

function badgeVariant(status: string, kind: BadgeKind): 'neutral' | 'success' | 'warning' {
  if (kind === 'review') {
    if (status === 'published') return 'success';
    if (status === 'scheduled') return 'neutral';
    if (status === 'cancelled') return 'warning';
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'warning';
    return 'neutral';
  }

  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'warning';
  if (status === 'failed' || status === 'rejected') return 'warning';
  if (status === 'scheduled') return 'neutral';
  if (
    status.startsWith('generating') ||
    status === 'selecting_idea' ||
    status === 'rendering_video' ||
    status === 'auto_reviewing' ||
    status === 'publishing' ||
    status === 'syncing_analytics'
  ) {
    return 'neutral';
  }
  if (status === 'pending_review') return 'neutral';
  if (status === 'published' || status === 'approved') return 'success';
  return 'neutral';
}

export function StatusBadge({
  status,
  kind = 'review',
}: {
  status: string;
  kind?: BadgeKind;
}) {
  const t = useTranslations('status');
  const keys = kind === 'pipeline' ? PIPELINE_KEYS : REVIEW_KEYS;
  const key = keys[status];
  const label = key ? t(key) : status;

  return <Chip variant={badgeVariant(status, kind)}>{label}</Chip>;
}
