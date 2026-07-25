import fs from 'node:fs/promises';
import { getStoragePath } from '@autotube/config';
import { prisma } from '@autotube/database';

async function unlinkQuiet(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // archivo ya ausente
  }
}

async function rmDirQuiet(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[cleanup] No se pudo borrar ${dirPath}:`, err);
  }
}

/** Borra archivos locales de un pipeline sin tocar registros en BD. */
export async function cleanupPipelineRunStorage(pipelineRunId: string): Promise<string[]> {
  const video = await prisma.video.findFirst({
    where: { pipelineRunId },
    include: { clips: true },
  });

  const freedPaths: string[] = [];

  if (video) {
    for (const p of [video.filePath, video.thumbnailPath]) {
      if (p) freedPaths.push(p);
      await unlinkQuiet(p);
    }
    for (const clip of video.clips) {
      for (const p of [clip.filePath, clip.thumbnailPath]) {
        if (p) freedPaths.push(p);
        await unlinkQuiet(p);
      }
    }
  }

  const pipelineDir = getStoragePath('pipelines', pipelineRunId);
  const videoDir = getStoragePath('videos', pipelineRunId);
  freedPaths.push(pipelineDir, videoDir);
  await rmDirQuiet(pipelineDir);
  await rmDirQuiet(videoDir);

  return freedPaths;
}

/** Elimina archivos en disco y el pipeline run completo (cascade en BD). */
export async function deletePipelineRunCompletely(pipelineRunId: string): Promise<{
  videoId: string | null;
  freedPaths: string[];
}> {
  const video = await prisma.video.findFirst({
    where: { pipelineRunId },
    include: { clips: true },
  });

  const freedPaths = await cleanupPipelineRunStorage(pipelineRunId);

  if (video) {
    await prisma.analyticsSnapshot.deleteMany({ where: { videoId: video.id } });
  }

  await prisma.pipelineRun.delete({ where: { id: pipelineRunId } });

  console.info(
    `[cleanup] Pipeline ${pipelineRunId} eliminado` +
      (video ? ` (video=${video.id}, ${video.clips.length} clips)` : ''),
  );

  return { videoId: video?.id ?? null, freedPaths };
}

/** Borra archivos locales pero conserva el registro (p. ej. vídeo ya en YouTube). */
export async function deleteVideoLocalFilesOnly(videoId: string): Promise<string[]> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { clips: true },
  });
  if (!video) throw new Error('Video not found');

  const freedPaths: string[] = [];

  for (const p of [video.filePath, video.thumbnailPath]) {
    if (p) freedPaths.push(p);
    await unlinkQuiet(p);
  }
  for (const clip of video.clips) {
    for (const p of [clip.filePath, clip.thumbnailPath]) {
      if (p) freedPaths.push(p);
      await unlinkQuiet(p);
    }
  }

  const pipelineDir = getStoragePath('pipelines', video.pipelineRunId);
  const videoDir = getStoragePath('videos', video.pipelineRunId);
  freedPaths.push(pipelineDir, videoDir);
  await rmDirQuiet(pipelineDir);
  await rmDirQuiet(videoDir);

  await prisma.videoClip.deleteMany({ where: { videoId } });
  await prisma.video.update({
    where: { id: videoId },
    data: { filePath: '', thumbnailPath: null },
  });

  console.info(`[cleanup] Archivos locales eliminados video=${videoId}`);
  return freedPaths;
}
