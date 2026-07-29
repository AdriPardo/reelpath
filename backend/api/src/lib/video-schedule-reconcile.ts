import { prisma } from '@autotube/database';

/**
 * Vídeos subidos a YouTube con `publishAt` futuro quedan en `scheduled`.
 * Cuando esa fecha pasa, YouTube ya los ha publicado pero Autotube no actualizaba
 * el estado — el planificador los trataba como pendientes y inventaba slots nuevos.
 *
 * Marca como `published` los que ya tienen `youtubeVideoId` y la fecha programada
 * ya venció (o no hay fecha futura).
 */
export async function reconcileOverdueYoutubeScheduledVideos(
  channelId?: string,
): Promise<number> {
  const now = new Date();

  const overdue = await prisma.video.findMany({
    where: {
      ...(channelId ? { channelId } : {}),
      youtubeVideoId: { not: null },
      reviewStatus: { in: ['pending', 'approved', 'scheduled'] },
      OR: [{ scheduledPublishAt: null }, { scheduledPublishAt: { lte: now } }],
    },
    select: { id: true, scheduledPublishAt: true },
    take: 500,
  });

  if (overdue.length === 0) return 0;

  await prisma.$transaction(
    overdue.map((v) =>
      prisma.video.update({
        where: { id: v.id },
        data: {
          reviewStatus: 'published',
          publishedAt: v.scheduledPublishAt ?? now,
          scheduledPublishAt: null,
        },
      }),
    ),
  );

  return overdue.length;
}

/** Candidatos al planificador: pendientes de programar, o aún en cola futura de YouTube. */
export function publicationPlanVideoWhere(channelId: string, now = new Date()) {
  return {
    channelId,
    reviewStatus: { in: ['pending', 'approved', 'scheduled'] },
    OR: [
      { youtubeVideoId: null },
      {
        youtubeVideoId: { not: null },
        scheduledPublishAt: { gt: now },
      },
    ],
  };
}
