import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { getStoragePath, parseChannelConfig, writeStorageFile } from '@autotube/config';
import { prisma } from '@autotube/database';
import { enqueuePipelineStep } from '@autotube/job-queue';

const execFileAsync = promisify(execFile);

export interface VideoProbeResult {
  durationSec: number;
  width: number;
  height: number;
  aspectRatio: '9:16' | '16:9';
}

export async function probeVideoFile(filePath: string): Promise<VideoProbeResult> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const width = parsed.streams?.[0]?.width ?? 1920;
  const height = parsed.streams?.[0]?.height ?? 1080;
  const durationSec = parseFloat(parsed.format?.duration ?? '0');
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error('No se pudo leer la duración del vídeo (¿archivo corrupto?)');
  }
  const ratio = width / height;
  const aspectRatio: '9:16' | '16:9' = ratio < 1 ? '9:16' : '16:9';
  return { durationSec, width, height, aspectRatio };
}

export interface UploadLongVideoParams {
  channelId: string;
  organizationId: string;
  originalFilename: string;
  buffer: Buffer;
  title?: string;
}

export interface UploadLongVideoResult {
  pipelineRunId: string;
  videoId: string;
  message: string;
}

const MAX_UPLOAD_MB_DEFAULT = 500;

export async function handleLongVideoUpload(
  params: UploadLongVideoParams,
): Promise<UploadLongVideoResult> {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: params.channelId } });
  const config = parseChannelConfig(channel.config);

  if (config.videoFormat !== 'long' && config.publishYoutubeShorts !== true) {
    throw Object.assign(
      new Error(
        'El canal debe estar en formato largo con Shorts activados para subir un vídeo y generar clips',
      ),
      { statusCode: 400 },
    );
  }

  const ext = path.extname(params.originalFilename).toLowerCase();
  if (ext !== '.mp4') {
    throw Object.assign(new Error('Solo se aceptan archivos MP4'), { statusCode: 415 });
  }

  const maxMb = MAX_UPLOAD_MB_DEFAULT;
  if (params.buffer.length > maxMb * 1024 * 1024) {
    throw Object.assign(
      new Error(`El archivo supera el límite de ${maxMb} MB`),
      { statusCode: 413 },
    );
  }

  const run = await prisma.pipelineRun.create({
    data: {
      channelId: params.channelId,
      status: 'rendering_video',
      currentStep: 'split_shorts',
      metadata: {
        source: 'upload',
        originalFilename: params.originalFilename,
      },
    },
  });

  const relativeKey = path.posix.join(
    'uploads',
    params.organizationId,
    run.id,
    'source.mp4',
  );
  const absPath = await writeStorageFile(relativeKey, params.buffer);

  const probe = await probeVideoFile(absPath);
  if (probe.durationSec < 30) {
    await prisma.pipelineRun.delete({ where: { id: run.id } });
    throw Object.assign(
      new Error('El vídeo debe durar al menos 30 segundos'),
      { statusCode: 400 },
    );
  }

  const baseTitle = params.title?.trim() || path.basename(params.originalFilename, ext);
  const title = baseTitle.slice(0, 200) || 'Vídeo subido';

  const video = await prisma.video.create({
    data: {
      pipelineRunId: run.id,
      channelId: params.channelId,
      title,
      description: `Vídeo subido manualmente — ${title}`,
      tags: ['shorts', 'upload'],
      filePath: getStoragePath('uploads', params.organizationId, run.id, 'source.mp4'),
      format: 'long',
      aspectRatio: probe.aspectRatio,
      durationSec: probe.durationSec,
      reviewStatus: 'pending',
    },
  });

  await enqueuePipelineStep(
    { pipelineRunId: run.id, channelId: params.channelId, splitOnly: true },
    'split_shorts',
  );

  return {
    pipelineRunId: run.id,
    videoId: video.id,
    message: 'Vídeo recibido. Generando Shorts…',
  };
}
