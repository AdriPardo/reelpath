import type { Job } from 'bullmq';
import { existsSync, statSync } from 'node:fs';
import { clearOrgPipelineOverrides, mergeChannelProductOverrides, parseChannelConfig, setOrgPipelineOverrides } from '@autotube/config';
import { loadOrgPipelineOverrides, prisma } from '@autotube/database';
import { clearOrgOpenAiApiKey, resetLlmClient } from '@autotube/llm';
import { scoreVideoQuality } from '@autotube/content-scorer';
import { generateIdeas, ensureSelectedIdea } from '@autotube/idea-generator';
import { enqueuePipelineStep } from '@autotube/job-queue';
import { generateMedia } from '@autotube/media-generator';
import { generateScript } from '@autotube/script-generator';
import type { ChannelConfig, PipelineJobPayload, PipelineRunMetadata, ScriptVariant } from '@autotube/shared';
import { computeShortPublishSlots, parseScheduledPublishAt, resolveDefaultShortCount, resolveMixedShortsCounts, resolvePlannerConfig, resolveSplitShortsCount } from '@autotube/shared';
import { renderVideo, resolveBgmFile, splitVideoForShorts } from '@autotube/video-renderer';
import {
  publishToYouTube,
  publishYouTubeShortsClips,
  deleteYouTubeVideoApi,
  resolveYouTubeCredentialsForChannel,
  crossPostVideoViaUploadPost,
  isUploadPostConfigured,
  type UploadPostPlatform,
} from '@autotube/youtube-publisher';
import { syncVideoAnalytics } from '@autotube/analytics';
import { generateDedicatedShort } from './dedicated-short.js';
import { notifyPipelineReadyForReview } from './pipeline-notify.js';
import { notifyPipelineFailed } from './pipeline-notify-failed.js';

async function maybeCrossPostAfterPublish(params: {
  videoId: string;
  config: ChannelConfig;
}): Promise<void> {
  if (params.config.crossPostEnabled !== true) return;
  if (!isUploadPostConfigured()) {
    console.info('[pipeline] cross-post skipped: Upload-Post not configured');
    return;
  }

  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    select: {
      title: true,
      description: true,
      tags: true,
      filePath: true,
      clips: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { filePath: true },
      },
    },
  });
  if (!video) return;

  const videoPath =
    video.clips[0]?.filePath && existsSync(video.clips[0].filePath)
      ? video.clips[0].filePath
      : video.filePath && existsSync(video.filePath)
        ? video.filePath
        : null;
  if (!videoPath) {
    console.warn('[pipeline] cross-post skipped: no local video file');
    return;
  }

  const platforms = (params.config.crossPostPlatforms ?? ['tiktok', 'instagram']).filter(
    (p): p is UploadPostPlatform => p === 'tiktok' || p === 'instagram' || p === 'youtube',
  );

  const result = await crossPostVideoViaUploadPost({
    videoPath,
    title: video.title,
    description: video.description ?? undefined,
    tags: video.tags ?? undefined,
    platforms,
  });

  console.info(
    `[pipeline] cross-post success=${result.success} skipped=${Boolean(result.skipped)} ` +
      `requestId=${result.requestId ?? '-'} error=${result.error ?? '-'}`,
  );
}

async function updatePipelineStatus(
  pipelineRunId: string,
  status: string,
  currentStep?: string,
  error?: string,
) {
  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: {
      status,
      currentStep: currentStep ?? null,
      error: error ?? null,
      completedAt:
        status === 'completed' || status === 'failed' || status === 'cancelled'
          ? new Date()
          : undefined,
    },
  });
}

async function isYouTubeAlreadyPublished(pipelineRunId: string): Promise<boolean> {
  const video = await prisma.video.findFirst({
    where: { pipelineRunId },
    select: { reviewStatus: true, youtubeVideoId: true },
  });
  if (!video) return false;
  return Boolean(video.youtubeVideoId) || video.reviewStatus === 'published';
}

async function isUploadPipeline(pipelineRunId: string): Promise<boolean> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    select: { metadata: true },
  });
  const meta = run?.metadata as { source?: string } | null;
  return meta?.source === 'upload';
}

async function finalizePreReviewClipStep(
  pipelineRunId: string,
  channelId: string,
): Promise<void> {
  if (await isYouTubeAlreadyPublished(pipelineRunId)) {
    await updatePipelineStatus(pipelineRunId, 'completed', 'publish');
    return;
  }
  if (await isUploadPipeline(pipelineRunId)) {
    await updatePipelineStatus(pipelineRunId, 'pending_review', 'await_review');
    await notifyPipelineReadyForReview(pipelineRunId);
    return;
  }
  await enqueuePipelineStep({ pipelineRunId, channelId }, 'auto_review');
}

function wantsYoutubeShortsClips(config: ChannelConfig): boolean {
  return config.publishYoutubeShorts === true && config.videoFormat === 'long';
}

function needsVerticalClipSplit(config: ChannelConfig): boolean {
  return wantsYoutubeShortsClips(config);
}

function usesDedicatedShort(config: ChannelConfig): boolean {
  return config.shortsMode === 'dedicated' && wantsYoutubeShortsClips(config);
}

function usesMixedShorts(config: ChannelConfig): boolean {
  return config.shortsMode === 'mixed' && wantsYoutubeShortsClips(config);
}

function verticalClipStep(config: ChannelConfig): 'split_shorts' | 'generate_short' {
  // Mixto: siempre cortar del largo primero; dedicated: solo teasers propios.
  if (usesDedicatedShort(config)) return 'generate_short';
  return 'split_shorts';
}

async function ensureLongSplitBeforeDedicated(
  pipelineRunId: string,
  config: ChannelConfig,
): Promise<boolean> {
  if (!usesMixedShorts(config)) return true;
  const { splitCount } = resolveMixedShortsCounts(config);
  if (splitCount <= 0) return true;

  const splitClip = await prisma.videoClip.findFirst({
    where: {
      pipelineRunId,
      platform: 'short_source',
      partIndex: { lt: splitCount },
    },
    select: { id: true },
  });
  return Boolean(splitClip);
}

async function enqueueAfterClipSplit(
  pipelineRunId: string,
  channelId: string,
  config: ChannelConfig,
): Promise<void> {
  if (wantsYoutubeShortsClips(config)) {
    await enqueuePipelineStep({ pipelineRunId, channelId }, 'publish_youtube_shorts');
    return;
  }
  await enqueuePipelineStep({ pipelineRunId, channelId }, 'sync_analytics');
}

export async function processPipelineJob(job: Job<PipelineJobPayload>): Promise<void> {
  const {
    pipelineRunId,
    channelId,
    step = 'generate_ideas',
    youtubeOnly,
    splitOnly,
    shortsOnly,
  } = job.data;

  const run = await prisma.pipelineRun.findUniqueOrThrow({
    where: { id: pipelineRunId },
    include: { channel: true },
  });

  if (run.status === 'cancelled') {
    console.info(`[pipeline] Omitiendo pipeline cancelado ${pipelineRunId} (paso=${step})`);
    return;
  }

  const overrides = await loadOrgPipelineOverrides(run.channel.organizationId);
  const channelConfig = parseChannelConfig(run.channel.config);
  setOrgPipelineOverrides(mergeChannelProductOverrides(overrides, channelConfig));
  const { loadPlatformSecretsOverrides } = await import('@autotube/database');
  await loadPlatformSecretsOverrides();
  resetLlmClient();

  const { loadEffectiveConfig } = await import('@autotube/config');
  const { getActiveLlmLabel, isLlmMockMode } = await import('@autotube/llm');
  const eff = loadEffectiveConfig();
  console.info(
    `[pipeline] run=${pipelineRunId} step=${step} llm=${getActiveLlmLabel()}` +
      ` mockLlm=${isLlmMockMode()} mockFlag=${eff.MOCK_EXTERNAL_APIS}` +
      ` tts=${eff.TTS_PROVIDER} dalle=${eff.GENERATE_DALLE_IMAGES}` +
      ` hasOpenAi=${!!eff.OPENAI_API_KEY} hasDeepseek=${!!eff.DEEPSEEK_API_KEY}` +
      ` hasEleven=${!!eff.ELEVENLABS_API_KEY}`,
  );

  try {
    await runPipelineStep(job, run, {
      pipelineRunId,
      channelId,
      step,
      youtubeOnly,
      splitOnly,
      shortsOnly,
    });
  } finally {
    clearOrgPipelineOverrides();
    clearOrgOpenAiApiKey();
    resetLlmClient();
  }
}

async function runPipelineStep(
  job: Job<PipelineJobPayload>,
  run: Awaited<ReturnType<typeof prisma.pipelineRun.findUniqueOrThrow>> & { channel: { id: string; organizationId: string; name: string; config: unknown } },
  ctx: {
    pipelineRunId: string;
    channelId: string;
    step: string;
    youtubeOnly?: boolean;
    splitOnly?: boolean;
    shortsOnly?: boolean;
  },
): Promise<void> {
  const { pipelineRunId, channelId, step, youtubeOnly, splitOnly, shortsOnly } = ctx;

  const config = parseChannelConfig(run.channel.config);

  async function requireApprovedVideo(pipelineRunId: string): Promise<{ id: string; reviewStatus: string }> {
    // Preferir el registro con fichero real (tras repair puede haber huérfanos vacíos).
    const video =
      (await prisma.video.findFirst({
        where: { pipelineRunId, filePath: { not: '' } },
        orderBy: { createdAt: 'desc' },
      })) ??
      (await prisma.video.findFirstOrThrow({
        where: { pipelineRunId },
        orderBy: { createdAt: 'desc' },
      }));
    const publishable = new Set(['approved', 'published', 'scheduled']);
    if (config.reviewRequired && !publishable.has(video.reviewStatus)) {
      console.info(`[pipeline] Video ${video.id} awaiting approval (status=${video.reviewStatus})`);
      await updatePipelineStatus(pipelineRunId, 'pending_review', 'await_review');
      throw new Error('SKIP_AWAITING_REVIEW');
    }
    return video;
  }

  function getPipelineScheduledPublishAt(): Date | null {
    const metadata = run.metadata as PipelineRunMetadata | null;
    return parseScheduledPublishAt(metadata?.scheduledPublishAt);
  }

  try {
    switch (step) {
      case 'generate_ideas': {
        await updatePipelineStatus(pipelineRunId, 'generating_ideas', step);
        const { runPipelinePreflight } = await import('./pipeline-preflight.js');
        const preflight = await runPipelinePreflight(config);
        for (const w of preflight.warnings) console.warn(`[pipeline/preflight] ${w}`);
        if (!preflight.ok) {
          throw new Error(`Preflight falló: ${preflight.errors.join('; ')}`);
        }
        await generateIdeas({ channelId, pipelineRunId, config });
        await enqueuePipelineStep({ pipelineRunId, channelId }, 'select_idea');
        break;
      }

      case 'select_idea': {
        await updatePipelineStatus(pipelineRunId, 'selecting_idea', step);
        const idea = await ensureSelectedIdea({ channelId, pipelineRunId, config });
        if (!idea) {
          throw new Error('No hay ideas disponibles para seleccionar');
        }
        await enqueuePipelineStep({ pipelineRunId, channelId }, 'generate_script');
        break;
      }

      case 'generate_script': {
        await updatePipelineStatus(pipelineRunId, 'generating_script', step);
        const idea = await prisma.videoIdea.findFirstOrThrow({
          where: { pipelineRunId, isSelected: true },
        });
        const { isScriptDevMode } = await import('@autotube/config');
        const { getActiveLlmLabel } = await import('@autotube/llm');
        const scriptMode = getActiveLlmLabel();
        console.info(
          `[worker] generate_script — ${scriptMode}` +
            (isScriptDevMode() ? ', dev económico' : '') +
            `, canal ${channelId}`,
        );
        await generateScript({
          channelId,
          pipelineRunId,
          config,
          idea: { title: idea.title, hook: idea.hook, angle: idea.angle },
        });
        await enqueuePipelineStep({ pipelineRunId, channelId }, 'generate_media');
        break;
      }

      case 'generate_media': {
        await updatePipelineStatus(pipelineRunId, 'generating_media', step);
        const scriptRecord = await prisma.script.findFirstOrThrow({ where: { pipelineRunId } });
        const variant = scriptRecord.selectedVariant as unknown as ScriptVariant;
        const org = await prisma.organization.findUnique({
          where: { id: run.channel.organizationId },
          select: { plan: true },
        });
        console.info(
          `[worker] generate_media — modo=${config.visualSourceMode ?? 'mixed'} plan=${org?.plan ?? 'trial'}`,
        );
        await generateMedia({
          pipelineRunId,
          script: variant,
          language: config.language,
          aspectRatio: config.aspectRatio,
          retentionMode: config.retentionMode,
          videoMotionIntensity: config.videoMotionIntensity,
          visualSourceMode: config.visualSourceMode,
          orgPlan: org?.plan,
          channelGenerateAiImages: config.generateAiImages,
          channelFalI2vEnabled: config.falI2vEnabled,
          channelMaxFalI2vPerVideo: config.maxFalI2vPerVideo,
          stockPlaybackSpeed: config.stockPlaybackSpeed,
        });
        await enqueuePipelineStep({ pipelineRunId, channelId }, 'render_video');
        break;
      }

      case 'render_video': {
        await updatePipelineStatus(pipelineRunId, 'rendering_video', step);
        const scriptRecord = await prisma.script.findFirstOrThrow({ where: { pipelineRunId } });
        const assets = await prisma.mediaAsset.findMany({ where: { pipelineRunId } });
        const variant = scriptRecord.selectedVariant as unknown as ScriptVariant;

        await renderVideo({
          pipelineRunId,
          channelId,
          templateId: config.templateId,
          script: variant,
          assets: assets.map((a) => ({
            sceneIndex: a.sceneIndex,
            type: a.type as 'audio' | 'image' | 'subtitle' | 'video',
            path: a.path,
            metadata: a.metadata as Record<string, unknown>,
          })),
          title: scriptRecord.title,
          description: scriptRecord.description,
          tags: scriptRecord.tags,
          format: config.videoFormat,
          aspectRatio: config.aspectRatio,
          reviewRequired: config.reviewRequired,
          retentionMode: config.retentionMode,
          videoMotionIntensity: config.videoMotionIntensity,
          bgmEnabled: config.bgmEnabled,
          bgmVolume: config.bgmVolume,
          bgmFile: config.bgmFile,
        });

        const repairMeta = run.metadata as { repairAudioRepublish?: boolean } | null;
        if (repairMeta?.repairAudioRepublish) {
          // Reparación de vídeo mudo: saltar shorts/review y republicar el long.
          await enqueuePipelineStep(
            { pipelineRunId, channelId, youtubeOnly: true },
            'publish',
            { replace: true },
          );
          break;
        }

        const clipSplit = needsVerticalClipSplit(config);

        if (config.reviewRequired && clipSplit) {
          await enqueuePipelineStep(
            { pipelineRunId, channelId, splitOnly: true },
            verticalClipStep(config),
          );
        } else if (config.reviewRequired) {
          await enqueuePipelineStep({ pipelineRunId, channelId }, 'auto_review');
        } else {
          await enqueuePipelineStep({ pipelineRunId, channelId }, 'publish');
        }
        break;
      }

      case 'auto_review': {
        await updatePipelineStatus(pipelineRunId, 'auto_reviewing', step);
        const video = await prisma.video.findFirstOrThrow({ where: { pipelineRunId } });
        const scriptRecord = await prisma.script.findFirstOrThrow({ where: { pipelineRunId } });
        const variant = scriptRecord.selectedVariant as unknown as ScriptVariant;
        const assets = await prisma.mediaAsset.findMany({ where: { pipelineRunId } });

        const audioAssets = assets.filter((a) => a.type === 'audio' && a.sceneIndex >= 0);
        const visualAssets = assets.filter(
          (a) => (a.type === 'image' || a.type === 'video') && a.sceneIndex >= 0,
        );

        let nearSilentAudioCount = 0;
        for (const a of audioAssets) {
          if (!existsSync(a.path)) {
            nearSilentAudioCount++;
            continue;
          }
          try {
            if (statSync(a.path).size < 800) nearSilentAudioCount++;
          } catch {
            nearSilentAudioCount++;
          }
        }

        const stockPaths = visualAssets
          .filter((a) => {
            const meta = (a.metadata ?? {}) as Record<string, unknown>;
            return meta.visualOrigin === 'stock' || a.type === 'video';
          })
          .map((a) => a.path);
        const pathCounts = new Map<string, number>();
        for (const p of stockPaths) pathCounts.set(p, (pathCounts.get(p) ?? 0) + 1);
        const repeatedStockCount = [...pathCounts.values()]
          .filter((n) => n > 1)
          .reduce((sum, n) => sum + (n - 1), 0);

        const missingWordBoundaryCount = audioAssets.filter((a) => {
          const meta = (a.metadata ?? {}) as Record<string, unknown>;
          const count = typeof meta.wordBoundaryCount === 'number' ? meta.wordBoundaryCount : 0;
          return count <= 0;
        }).length;

        const bgmEnabledWithoutTrack =
          config.bgmEnabled === true && !(await resolveBgmFile(config.bgmFile ?? null));

        const report = scoreVideoQuality({
          script: variant,
          format: config.videoFormat,
          durationSec: video.durationSec,
          filePathExists: video.filePath ? existsSync(video.filePath) : false,
          hasThumbnail: video.thumbnailPath ? existsSync(video.thumbnailPath) : false,
          sceneImageIndexes: assets
            .filter((a) => a.type === 'image' || a.type === 'video')
            .map((a) => a.sceneIndex),
          sceneAudioIndexes: audioAssets.map((a) => a.sceneIndex),
          hasSubtitles: assets.some((a) => a.type === 'subtitle'),
          title: video.title,
          description: video.description,
          forbiddenTopics: config.forbiddenTopics,
          minScoreToApprove: config.autoApproveMinScore,
          nearSilentAudioCount,
          repeatedStockCount,
          bgmEnabledWithoutTrack,
          missingWordBoundaryCount,
        });

        await prisma.video.update({
          where: { id: video.id },
          data: {
            qualityScore: report.score,
            qualityReport: report as unknown as object,
          },
        });

        const canAutoApprove = config.autoReview === true && report.autoApproved;
        console.info(
          `[pipeline] auto_review score=${report.score} passed=${report.passed} autoApprove=${canAutoApprove}`,
        );

        if (canAutoApprove) {
          await prisma.video.update({
            where: { id: video.id },
            data: { reviewStatus: 'approved' },
          });
          await enqueuePipelineStep(
            { pipelineRunId, channelId, youtubeOnly: true },
            'publish',
          );
        } else {
          await updatePipelineStatus(pipelineRunId, 'pending_review', 'await_review');
          await notifyPipelineReadyForReview(pipelineRunId);
        }
        break;
      }

      case 'publish': {
        await updatePipelineStatus(pipelineRunId, 'publishing', step);
        const video = await requireApprovedVideo(pipelineRunId);

        const publishYoutube = config.publishYoutube !== false;
        const clipSplit = needsVerticalClipSplit(config) && !youtubeOnly;

        const repairMeta = run.metadata as {
          repairAudioRepublish?: boolean;
          previousYoutubeVideoId?: string | null;
        } | null;

        if (repairMeta?.repairAudioRepublish && publishYoutube) {
          const previousId =
            repairMeta.previousYoutubeVideoId ??
            (
              await prisma.video.findUnique({
                where: { id: video.id },
                select: { youtubeVideoId: true },
              })
            )?.youtubeVideoId ??
            null;

          await prisma.video.update({
            where: { id: video.id },
            data: {
              youtubeVideoId: null,
              publishedAt: null,
              reviewStatus: 'approved',
              scheduledPublishAt: null,
            },
          });

          const published = await publishToYouTube(video.id);

          if (previousId && !previousId.startsWith('mock_') && published.youtubeVideoId !== previousId) {
            const creds = await resolveYouTubeCredentialsForChannel(channelId);
            if (creds) {
              try {
                await deleteYouTubeVideoApi(previousId, creds);
              } catch (err) {
                console.warn(
                  `[pipeline] No se pudo borrar YouTube anterior ${previousId}:`,
                  err instanceof Error ? err.message : err,
                );
              }
            }
          }

          const meta = { ...((run.metadata as Record<string, unknown> | null) ?? {}) };
          delete meta.repairAudioRepublish;
          delete meta.previousYoutubeVideoId;
          await prisma.pipelineRun.update({
            where: { id: pipelineRunId },
            data: { metadata: meta as object },
          });
          await updatePipelineStatus(pipelineRunId, 'completed', 'publish');
          break;
        }

        const existingSchedule = (
          await prisma.video.findUnique({
            where: { id: video.id },
            select: { scheduledPublishAt: true },
          })
        )?.scheduledPublishAt;
        const metadataSchedule = getPipelineScheduledPublishAt();
        const scheduleAt =
          existingSchedule && existingSchedule.getTime() > Date.now()
            ? existingSchedule
            : metadataSchedule;

        if (scheduleAt && scheduleAt.getTime() > Date.now()) {
          await prisma.video.update({
            where: { id: video.id },
            data: { reviewStatus: 'scheduled', scheduledPublishAt: scheduleAt },
          });
        } else if (video.reviewStatus === 'pending') {
          await prisma.video.update({
            where: { id: video.id },
            data: { reviewStatus: 'approved' },
          });
        }

        if (publishYoutube) {
          await publishToYouTube(video.id);
          await maybeCrossPostAfterPublish({ videoId: video.id, config });
        } else if (video.reviewStatus !== 'published') {
          await prisma.video.update({
            where: { id: video.id },
            data: { reviewStatus: 'published', publishedAt: new Date() },
          });
          await maybeCrossPostAfterPublish({ videoId: video.id, config });
        }

        if (clipSplit) {
          await enqueuePipelineStep({ pipelineRunId, channelId }, verticalClipStep(config));
        } else if (wantsYoutubeShortsClips(config)) {
          // Flujo de revisión/aprobación (youtubeOnly): los clips verticales ya se
          // dividieron antes de la revisión. Súbelos ahora como YouTube Shorts.
          await enqueuePipelineStep(
            { pipelineRunId, channelId, youtubeOnly },
            'publish_youtube_shorts',
          );
        } else if (youtubeOnly) {
          await updatePipelineStatus(pipelineRunId, 'completed', 'publish');
        } else {
          await enqueuePipelineStep({ pipelineRunId, channelId }, 'sync_analytics');
        }
        break;
      }

      case 'split_shorts': {
        const isPreReviewSplit = Boolean(splitOnly || config.reviewRequired);
        await updatePipelineStatus(
          pipelineRunId,
          isPreReviewSplit ? 'rendering_video' : 'publishing',
          step,
        );
        const video = splitOnly
          ? await prisma.video.findFirstOrThrow({ where: { pipelineRunId } })
          : await requireApprovedVideo(pipelineRunId);

        if (usesMixedShorts(config)) {
          const { splitCount, dedicatedCount } = resolveMixedShortsCounts(config);
          await splitVideoForShorts(video.id, config.shortsClipMaxSec, { maxParts: splitCount });
          if (dedicatedCount > 0) {
            await enqueuePipelineStep(
              { pipelineRunId, channelId, splitOnly: isPreReviewSplit || undefined },
              'generate_short',
            );
          } else if (isPreReviewSplit) {
            await finalizePreReviewClipStep(pipelineRunId, channelId);
          } else {
            await enqueueAfterClipSplit(pipelineRunId, channelId, config);
          }
        } else {
          const splitCount = resolveSplitShortsCount(config);
          await splitVideoForShorts(
            video.id,
            config.shortsClipMaxSec,
            splitCount != null ? { maxParts: splitCount } : undefined,
          );
          if (isPreReviewSplit) {
            await finalizePreReviewClipStep(pipelineRunId, channelId);
          } else {
            await enqueueAfterClipSplit(pipelineRunId, channelId, config);
          }
        }
        break;
      }

      case 'generate_short': {
        const isPreReview = Boolean(splitOnly || config.reviewRequired);
        await updatePipelineStatus(
          pipelineRunId,
          isPreReview ? 'rendering_video' : 'publishing',
          step,
        );
        if (!splitOnly) {
          await requireApprovedVideo(pipelineRunId);
        } else {
          await prisma.video.findFirstOrThrow({ where: { pipelineRunId } });
        }

        if (usesMixedShorts(config)) {
          const hasSplitClip = await ensureLongSplitBeforeDedicated(pipelineRunId, config);
          if (!hasSplitClip) {
            console.warn(
              `[pipeline] Modo mixto: falta corte del largo; reencolando split_shorts antes de teasers`,
            );
            await enqueuePipelineStep(
              { pipelineRunId, channelId, splitOnly: isPreReview || undefined },
              'split_shorts',
            );
            break;
          }

          const { splitCount, dedicatedCount } = resolveMixedShortsCounts(config);
          await generateDedicatedShort(pipelineRunId, channelId, config, {
            count: dedicatedCount,
            startPartIndex: splitCount,
            replaceMode: 'dedicated-only',
          });
        } else {
          await generateDedicatedShort(pipelineRunId, channelId, config);
        }

        if (isPreReview) {
          await finalizePreReviewClipStep(pipelineRunId, channelId);
        } else {
          await enqueueAfterClipSplit(pipelineRunId, channelId, config);
        }
        break;
      }

      case 'publish_youtube_shorts': {
        await updatePipelineStatus(pipelineRunId, 'publishing', step);
        const video = await requireApprovedVideo(pipelineRunId);
        // baseTime = fecha programada del vídeo largo si la hubiera; si no, ahora (al aprobar).
        // El Short 0 sale con el vídeo largo y los siguientes se escalonan cada intervalDays.
        // En republicación (shortsOnly): ancla al schedule/publish original para recalcular
        // las mismas franjas si el clip no guardó scheduledPublishAt.
        const videoTimes = await prisma.video.findUnique({
          where: { id: video.id },
          select: { scheduledPublishAt: true, publishedAt: true },
        });
        const scheduledAt = videoTimes?.scheduledPublishAt;
        const publishedAt = videoTimes?.publishedAt;
        const baseTime =
          scheduledAt && scheduledAt.getTime() > Date.now()
            ? scheduledAt
            : shortsOnly && publishedAt
              ? publishedAt
              : scheduledAt && shortsOnly
                ? scheduledAt
                : new Date();

        const planner = resolvePlannerConfig(config);
        const sourceClipCount = await prisma.videoClip.count({
          where: { pipelineRunId, platform: 'short_source' },
        });
        const shortCount = sourceClipCount > 0 ? sourceClipCount : resolveDefaultShortCount(config);
        const scheduledSlots =
          planner.publishPlannerEnabled && shortCount > 0
            ? computeShortPublishSlots(baseTime, shortCount, config)
            : undefined;

        await publishYouTubeShortsClips(pipelineRunId, {
          baseTime,
          intervalDays: config.shortsPublishIntervalDays ?? 1,
          scheduledSlots,
          preferExistingSchedule: shortsOnly === true,
        });
        await enqueuePipelineStep({ pipelineRunId, channelId }, 'sync_analytics');
        break;
      }

      case 'sync_analytics': {
        await updatePipelineStatus(pipelineRunId, 'syncing_analytics', step);
        const video = await prisma.video.findFirst({ where: { pipelineRunId } });
        if (video) await syncVideoAnalytics(video.id);
        await updatePipelineStatus(pipelineRunId, 'completed', step);
        break;
      }

      case 'optimize_prompts': {
        console.info(`[pipeline] optimize_prompts omitido (noop) run=${pipelineRunId}`);
        await updatePipelineStatus(pipelineRunId, 'completed', step);
        break;
      }

      default:
        throw new Error(`Paso de pipeline desconocido: ${step}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'SKIP_AWAITING_REVIEW') {
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    await updatePipelineStatus(pipelineRunId, 'failed', step, message);
    await notifyPipelineFailed({
      pipelineRunId,
      organizationId: run.channel.organizationId,
      channelName: run.channel.name,
      error: message,
    });
    throw err;
  }
}

export async function resumeAfterApproval(pipelineRunId: string): Promise<void> {
  const run = await prisma.pipelineRun.findUniqueOrThrow({ where: { id: pipelineRunId } });
  await enqueuePipelineStep({ pipelineRunId, channelId: run.channelId }, 'publish');
}
