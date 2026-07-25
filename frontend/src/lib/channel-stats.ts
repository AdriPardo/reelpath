import type { Channel, PipelineRun, Video } from '@/lib/api';
import { isPipelineInProgress } from '@/lib/pipeline-status';
import { translate, type AppLocale } from '@/lib/i18n';

export type ChannelCardStats = {
  pendingReview: number;
  lastGenerationAt: string | null;
  activeGenerations: number;
};

function pipelineChannelId(pipeline: PipelineRun): string | undefined {
  return pipeline.channel?.id;
}

export function buildChannelStatsMap(
  channels: Channel[],
  pipelines: PipelineRun[],
  pendingVideos: Video[],
): Record<string, ChannelCardStats> {
  const map: Record<string, ChannelCardStats> = {};

  for (const channel of channels) {
    const channelPipelines = pipelines.filter((p) => pipelineChannelId(p) === channel.id);
    const sorted = [...channelPipelines].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    map[channel.id] = {
      pendingReview: pendingVideos.filter(
        (v) => v.channelId === channel.id || v.channel?.id === channel.id,
      ).length,
      lastGenerationAt: sorted[0]?.createdAt ?? null,
      activeGenerations: channelPipelines.filter((p) => isPipelineInProgress(p.status)).length,
    };
  }

  return map;
}

export function formatLastGeneration(iso: string | null, locale: AppLocale | string = 'es'): string {
  if (!iso) return translate(locale, 'channels.stats.noGenerations');

  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return translate(locale, 'common.today');
  if (diffDays === 1) return translate(locale, 'common.yesterday');
  if (diffDays < 7) return translate(locale, 'common.relativeDaysAgo', { count: diffDays });

  const dateLocale = locale === 'en' ? 'en-GB' : 'es-ES';
  return date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
}
