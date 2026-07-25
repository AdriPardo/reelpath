import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath } from '@autotube/config';
import { prisma } from '@autotube/database';
import { enqueuePipelineStep } from '@autotube/job-queue';
import type { ScriptScene, ScriptVariant } from '@autotube/shared';

export async function loadScriptVariant(pipelineRunId: string): Promise<{
  scriptId: string;
  variant: ScriptVariant;
}> {
  const script = await prisma.script.findFirstOrThrow({ where: { pipelineRunId } });
  return {
    scriptId: script.id,
    variant: script.selectedVariant as unknown as ScriptVariant,
  };
}

export function normalizeScenes(scenes: ScriptScene[]): ScriptScene[] {
  return scenes.map((scene, i) => ({
    ...scene,
    index: i,
  }));
}

export async function deleteSceneAssets(pipelineRunId: string, sceneIndex: number): Promise<void> {
  const baseDir = getStoragePath('pipelines', pipelineRunId);
  const patterns = [
    `scene-${sceneIndex}-audio.mp3`,
    `scene-${sceneIndex}-image.png`,
    `scene-${sceneIndex}.ass`,
    `scene-${sceneIndex}.srt`,
  ];
  for (const name of patterns) {
    await fs.unlink(path.join(baseDir, name)).catch(() => {});
  }
  await prisma.mediaAsset.deleteMany({
    where: { pipelineRunId, sceneIndex },
  });
}

export async function enqueueSceneRerender(
  pipelineRunId: string,
  channelId: string,
): Promise<void> {
  await prisma.pipelineRun.update({
    where: { id: pipelineRunId },
    data: { status: 'generating_media', currentStep: 'generate_media' },
  });
  await enqueuePipelineStep({ pipelineRunId, channelId }, 'generate_media', { replace: true });
}
