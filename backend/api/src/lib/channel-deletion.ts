import { prisma } from '@autotube/database';
import { cancelPipelineJobsForRun } from '@autotube/job-queue';
import { cleanupPipelineRunStorage } from './pipeline-cleanup.js';

/** Cancela jobs en cola, limpia archivos locales y elimina el canal (cascade en BD). */
export async function deleteChannelWithCleanup(channelId: string): Promise<void> {
  const runs = await prisma.pipelineRun.findMany({
    where: { channelId },
    select: { id: true },
  });

  for (const run of runs) {
    try {
      await cancelPipelineJobsForRun(run.id);
      await cleanupPipelineRunStorage(run.id);
    } catch (err) {
      console.warn(`[channel-delete] Error preparando pipeline ${run.id}:`, err);
    }
  }

  await prisma.channel.delete({ where: { id: channelId } });
}
