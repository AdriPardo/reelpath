import { loadConfig } from '@autotube/config';
import { prisma } from '@autotube/database';
import { resolveYouTubeCredentialsForChannel } from './credentials.js';
import { formatYouTubeShortMetadata } from './metadata.js';
import { uploadToYouTubeApi } from './upload.js';

// YouTube admite Shorts de hasta 3 minutos (180s) desde octubre 2024.
// Un pequeño margen evita descartar clips de ~60s que quedan en 60.0x por el encoding.
const YOUTUBE_SHORTS_MAX_SEC = 180;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface YouTubeShortsPublishSummary {
  published: number;
  scheduled: number;
  failed: number;
  mock: boolean;
  clips: Array<{
    clipId: string;
    youtubeVideoId: string;
    partIndex: number;
    scheduledPublishAt: string | null;
  }>;
}

export interface PublishYouTubeShortsOptions {
  /** Momento base a partir del cual se escalonan los Shorts (por defecto ahora). */
  baseTime?: Date;
  /** Días entre Shorts consecutivos (0 = todos ya, sin escalonar). */
  intervalDays?: number;
  /** Horarios precalculados por orderIndex (planificador); anula intervalDays si se proporciona. */
  scheduledSlots?: Date[];
  /**
   * Si true, reutiliza `scheduledPublishAt` ya guardado en el clip youtube_shorts
   * (p. ej. republicar fallidos con la programación que les tocaba).
   */
  preferExistingSchedule?: boolean;
}

export {
  clampYouTubeTitle,
  formatYouTubeShortTitle,
  formatYouTubeShortMetadata,
  YOUTUBE_TITLE_MAX_CHARS,
} from './metadata.js';

function isMockExternalId(externalId: string | null | undefined): boolean {
  return !!externalId?.startsWith('mock_');
}

export async function publishYouTubeShortsClips(
  pipelineRunId: string,
  options?: PublishYouTubeShortsOptions,
): Promise<YouTubeShortsPublishSummary> {
  const video = await prisma.video.findFirstOrThrow({ where: { pipelineRunId } });
  const config = loadConfig();
  const creds = await resolveYouTubeCredentialsForChannel(video.channelId);
  const canUploadReal = !config.MOCK_EXTERNAL_APIS && creds !== null;

  const baseTime = options?.baseTime ?? new Date();
  const intervalDays = Math.max(0, options?.intervalDays ?? 0);
  const scheduledSlots = options?.scheduledSlots;

  const sourceClips = await prisma.videoClip.findMany({
    where: { pipelineRunId, platform: 'short_source' },
    orderBy: { partIndex: 'asc' },
  });

  if (sourceClips.length === 0) {
    console.warn(`[youtube/shorts] No source clips found for pipeline ${pipelineRunId}`);
    return { published: 0, scheduled: 0, failed: 0, mock: true, clips: [] };
  }

  const results: YouTubeShortsPublishSummary = {
    published: 0,
    scheduled: 0,
    failed: 0,
    mock: !canUploadReal,
    clips: [],
  };

  for (const [orderIndex, source] of sourceClips.entries()) {
    // El escalonado usa el orden de los clips fuente (0, 1, 2, …), no partIndex,
    // por si los índices no fueran contiguos.
    const publishAtCandidate = scheduledSlots?.[orderIndex]
      ?? (intervalDays > 0
        ? new Date(baseTime.getTime() + orderIndex * intervalDays * MS_PER_DAY)
        : null);

    if (source.durationSec > YOUTUBE_SHORTS_MAX_SEC) {
      console.warn(
        `[youtube/shorts] Part ${source.partIndex + 1} skipped (${source.durationSec.toFixed(0)}s > ${YOUTUBE_SHORTS_MAX_SEC}s)`,
      );
      continue;
    }

    let ytClip = await prisma.videoClip.findFirst({
      where: { videoId: video.id, platform: 'youtube_shorts', partIndex: source.partIndex },
    });

    if (!ytClip) {
      ytClip = await prisma.videoClip.create({
        data: {
          videoId: video.id,
          pipelineRunId,
          partIndex: source.partIndex,
          title: source.title,
          filePath: source.filePath,
          thumbnailPath: source.thumbnailPath,
          durationSec: source.durationSec,
          aspectRatio: '9:16',
          platform: 'youtube_shorts',
          publishStatus: 'pending',
        },
      });
    }

    const wasMock = isMockExternalId(ytClip.externalId);
    const alreadyDone = ytClip.publishStatus === 'published' || ytClip.publishStatus === 'scheduled';
    if (alreadyDone && ytClip.externalId && !wasMock) {
      if (ytClip.publishStatus === 'scheduled') results.scheduled++;
      else results.published++;
      results.clips.push({
        clipId: ytClip.id,
        youtubeVideoId: ytClip.externalId,
        partIndex: ytClip.partIndex,
        scheduledPublishAt: ytClip.scheduledPublishAt?.toISOString() ?? null,
      });
      continue;
    }

    // República fallidos: respeta la franja que ya tenía el clip; si no, la candidata nueva.
    const preferExisting = options?.preferExistingSchedule === true;
    const existingSlot =
      preferExisting && ytClip.scheduledPublishAt ? ytClip.scheduledPublishAt : null;
    const slot = existingSlot ?? publishAtCandidate;
    const scheduledPublishAt = slot && slot.getTime() > Date.now() ? slot : null;
    // Guardamos la franja prevista aunque ya haya pasado (para UI / siguiente retry).
    const intendedSchedule = slot ?? null;

    const meta = formatYouTubeShortMetadata(source.title, video.description, video.tags);

    try {
      const youtubeVideoId = canUploadReal
        ? await uploadToYouTubeApi(
            {
              filePath: source.filePath,
              title: meta.title,
              description: meta.description,
              tags: meta.tags,
              ...(scheduledPublishAt ? { publishAt: scheduledPublishAt } : {}),
            },
            creds!,
          )
        : `mock_ytshort_${ytClip.id.slice(0, 8)}_p${source.partIndex}`;

      await prisma.videoClip.update({
        where: { id: ytClip.id },
        data: {
          externalId: youtubeVideoId,
          publishStatus: scheduledPublishAt ? 'scheduled' : 'published',
          scheduledPublishAt: scheduledPublishAt ?? null,
          publishedAt: scheduledPublishAt ? null : new Date(),
          error: null,
        },
      });

      if (scheduledPublishAt) {
        results.scheduled++;
      } else {
        results.published++;
      }
      results.clips.push({
        clipId: ytClip.id,
        youtubeVideoId,
        partIndex: source.partIndex,
        scheduledPublishAt: scheduledPublishAt?.toISOString() ?? null,
      });
      console.info(
        `[youtube/shorts] Part ${source.partIndex + 1}/${sourceClips.length} ${
          canUploadReal ? (scheduledPublishAt ? 'scheduled' : 'published') : 'mock'
        }${scheduledPublishAt ? ` for ${scheduledPublishAt.toISOString()}` : ''}: ${meta.title}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.videoClip.update({
        where: { id: ytClip.id },
        data: {
          publishStatus: 'failed',
          error: message,
          // Conserva la programación prevista para poder republicar en la misma franja.
          ...(intendedSchedule ? { scheduledPublishAt: intendedSchedule } : {}),
        },
      });
      results.failed++;
      console.error(`[youtube/shorts] Part ${source.partIndex + 1} failed:`, message);
    }
  }

  return results;
}
