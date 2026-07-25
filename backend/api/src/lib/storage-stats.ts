import fs from 'node:fs/promises';
import path from 'node:path';
import { getStoragePath, loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';

async function dirSizeBytes(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await dirSizeBytes(full);
      } else if (entry.isFile()) {
        const stat = await fs.stat(full);
        total += stat.size;
      }
    }
  } catch {
    // directorio inexistente
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function getStorageStats() {
  const config = loadConfig();
  const storageRoot = getStoragePath();
  const pipelinesRoot = getStoragePath('pipelines');
  const videosRoot = getStoragePath('videos');

  const [pipelinesBytes, videosBytes, pipelineCount, videoCount, clipCount, runCount] =
    await Promise.all([
      dirSizeBytes(pipelinesRoot),
      dirSizeBytes(videosRoot),
      fs.readdir(pipelinesRoot).then((d) => d.length).catch(() => 0),
      prisma.video.count(),
      prisma.videoClip.count(),
      prisma.pipelineRun.count(),
    ]);

  const totalBytes = pipelinesBytes + videosBytes;

  return {
    storagePath: storageRoot,
    totalBytes,
    totalFormatted: formatBytes(totalBytes),
    pipelinesBytes,
    pipelinesFormatted: formatBytes(pipelinesBytes),
    videosBytes,
    videosFormatted: formatBytes(videosBytes),
    pipelineDirs: pipelineCount,
    pipelineRuns: runCount,
    videos: videoCount,
    clips: clipCount,
  };
}

export { formatBytes };
