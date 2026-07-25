import {
  buildPipelineCompletedEmail,
  loadConfig,
  sendEmail,
} from '@autotube/config';
import { prisma } from '@autotube/database';

export async function notifyPipelineReadyForReview(pipelineRunId: string): Promise<void> {
  try {
    const run = await prisma.pipelineRun.findUnique({
      where: { id: pipelineRunId },
      include: {
        channel: {
          select: {
            name: true,
            organizationId: true,
          },
        },
        videos: { take: 1, select: { id: true, title: true } },
      },
    });

    if (!run?.videos[0]) return;

    const config = loadConfig();

    await prisma.notification.create({
      data: {
        organizationId: run.channel.organizationId,
        kind: 'pipeline_completed',
        title: 'Vídeo listo para revisar',
        message: `«${run.videos[0].title}» en ${run.channel.name}`,
        href: `/videos/${run.videos[0].id}`,
        severity: 'info',
      },
    });

    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId: run.channel.organizationId, role: 'owner' },
      include: { user: { select: { email: true, name: true, locale: true } } },
    });

    if (!owner?.user.email) return;

    const locale = owner.user.locale === 'en' ? 'en' : 'es';
    const content = buildPipelineCompletedEmail({
      userName: owner.user.name,
      channelName: run.channel.name,
      videoTitle: run.videos[0].title,
      reviewUrl: `${config.FRONTEND_URL}/${locale}/videos/${run.videos[0].id}`,
      locale,
    });

    await sendEmail({
      to: owner.user.email,
      templateId: 'pipeline_completed',
      ...content,
    });
  } catch (err) {
    console.warn(
      `[pipeline-notify] No se pudo notificar pipeline=${pipelineRunId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
