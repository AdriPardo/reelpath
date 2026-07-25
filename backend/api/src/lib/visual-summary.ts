import { prisma } from '@autotube/database';
import { computeVisualOriginSummary, type VisualOriginSummary } from '@autotube/shared';

export async function attachVisualSummaries<T extends { pipelineRunId: string }>(
  videos: T[],
): Promise<Array<T & { visualSummary: VisualOriginSummary | null }>> {
  if (videos.length === 0) return [];

  const runIds = [...new Set(videos.map((v) => v.pipelineRunId))];
  const assets = await prisma.mediaAsset.findMany({
    where: {
      pipelineRunId: { in: runIds },
      type: { in: ['image', 'video'] },
    },
    select: {
      pipelineRunId: true,
      sceneIndex: true,
      type: true,
      metadata: true,
    },
  });

  const byRun = new Map<string, typeof assets>();
  for (const asset of assets) {
    const list = byRun.get(asset.pipelineRunId) ?? [];
    list.push(asset);
    byRun.set(asset.pipelineRunId, list);
  }

  return videos.map((video) => ({
    ...video,
    visualSummary:
      computeVisualOriginSummary(
        (byRun.get(video.pipelineRunId) ?? []).map((a) => ({
          sceneIndex: a.sceneIndex,
          type: a.type,
          metadata: a.metadata as Record<string, unknown> | null,
        })),
      ) ?? null,
  }));
}

export async function attachVisualSummary<T extends { pipelineRunId: string }>(
  video: T,
): Promise<T & { visualSummary: VisualOriginSummary | null }> {
  const [withSummary] = await attachVisualSummaries([video]);
  return withSummary;
}
