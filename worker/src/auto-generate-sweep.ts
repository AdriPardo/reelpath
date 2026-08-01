import { parseChannelConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { enqueuePipeline } from '@autotube/job-queue';
import { deriveChannelPublishInsights } from '@autotube/analytics';
import {
  computeNextPublishSlot,
  getZonedParts,
  shouldAutoGenerateForSlot,
} from '@autotube/shared';
import { hasYouTubeCredentialsForChannel } from '@autotube/youtube-publisher';

export interface AutoGenerateSweepResult {
  checked: number;
  triggered: number;
  skipped: number;
  errors: Array<{ channelId: string; reason: string }>;
  triggeredChannelIds: string[];
}

const ACTIVE_PIPELINE_STATUSES = [
  'scheduled',
  'running',
  'generating_ideas',
  'selecting_idea',
  'generating_script',
  'generating_media',
  'rendering_video',
  'auto_reviewing',
  'publishing',
  'pending_review',
  'syncing_analytics',
];

function localDateKey(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

async function channelHasBlockingPipeline(channelId: string): Promise<boolean> {
  const active = await prisma.pipelineRun.findFirst({
    where: {
      channelId,
      status: { in: ACTIVE_PIPELINE_STATUSES },
    },
    select: { id: true },
  });
  return Boolean(active);
}

async function hasVideoScheduledOnLocalDay(
  channelId: string,
  timeZone: string,
  dayKey: string,
): Promise<boolean> {
  const videos = await prisma.video.findMany({
    where: {
      channelId,
      scheduledPublishAt: { gt: new Date() },
    },
    select: { scheduledPublishAt: true },
    take: 200,
  });
  return videos.some((v) => {
    if (!v.scheduledPublishAt) return false;
    return localDateKey(getZonedParts(v.scheduledPublishAt, timeZone)) === dayKey;
  });
}

async function hasRecentAutoRunForSlot(
  channelId: string,
  slotIso: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const runs = await prisma.pipelineRun.findMany({
    where: { channelId, createdAt: { gte: since } },
    select: { metadata: true },
    take: 50,
  });
  return runs.some((run) => {
    const meta = run.metadata as { scheduledPublishAt?: string; source?: string } | null;
    return meta?.scheduledPublishAt === slotIso && meta?.source === 'auto_generate';
  });
}

/**
 * Recorre canales con autoGenerateEnabled y encola como máximo 1 pipeline por canal
 * cuando el margen respecto al próximo slot de publicación se cumple.
 */
export async function runAutoGenerateSweep(
  now = new Date(),
): Promise<AutoGenerateSweepResult> {
  const channels = await prisma.channel.findMany({
    where: { isActive: true },
    select: { id: true, organizationId: true, config: true },
    take: 500,
  });

  const result: AutoGenerateSweepResult = {
    checked: 0,
    triggered: 0,
    skipped: 0,
    errors: [],
    triggeredChannelIds: [],
  };

  for (const channel of channels) {
    const config = parseChannelConfig(channel.config);
    if (!config.autoGenerateEnabled || !config.publishPlannerEnabled) {
      continue;
    }
    result.checked += 1;

    try {
      if (config.publishYoutube !== false) {
        const hasYt = await hasYouTubeCredentialsForChannel(channel.id);
        if (!hasYt) {
          result.skipped += 1;
          result.errors.push({ channelId: channel.id, reason: 'youtube_disconnected' });
          continue;
        }
      }

      if (await channelHasBlockingPipeline(channel.id)) {
        result.skipped += 1;
        continue;
      }

      const insights = await deriveChannelPublishInsights(channel.id);
      const existing = (
        await prisma.video.findMany({
          where: { channelId: channel.id, scheduledPublishAt: { gt: now } },
          select: { scheduledPublishAt: true },
          take: 500,
        })
      )
        .map((v) => v.scheduledPublishAt)
        .filter((d): d is Date => d !== null);

      const slot = computeNextPublishSlot(config, existing, { referenceDate: now, insights });
      const leadDays = config.autoGenerateLeadDays ?? 1;
      const tz = config.timezone ?? 'Europe/Madrid';

      if (
        !shouldAutoGenerateForSlot({
          now,
          publishAt: slot,
          timeZone: tz,
          leadDays,
          getZoned: getZonedParts,
        })
      ) {
        result.skipped += 1;
        continue;
      }

      const dayKey = localDateKey(getZonedParts(slot, tz));
      if (await hasVideoScheduledOnLocalDay(channel.id, tz, dayKey)) {
        result.skipped += 1;
        continue;
      }

      const slotIso = slot.toISOString();
      if (await hasRecentAutoRunForSlot(channel.id, slotIso)) {
        result.skipped += 1;
        continue;
      }

      const run = await prisma.pipelineRun.create({
        data: {
          channelId: channel.id,
          status: 'scheduled',
          currentStep: 'generate_ideas',
          metadata: {
            source: 'auto_generate',
            scheduledPublishAt: slotIso,
          },
        },
      });

      await enqueuePipeline({ pipelineRunId: run.id, channelId: channel.id });
      result.triggered += 1;
      result.triggeredChannelIds.push(channel.id);
      console.info(
        `[auto-generate] channel=${channel.id} run=${run.id} publishAt=${slotIso} leadDays=${leadDays}`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      result.errors.push({ channelId: channel.id, reason });
      result.skipped += 1;
      console.warn(`[auto-generate] channel=${channel.id} failed:`, reason);
    }
  }

  return result;
}
