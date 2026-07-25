import {
  buildPipelineFailedEmail,
  loadConfig,
  sendEmail,
} from '@autotube/config';
import { prisma } from '@autotube/database';

export async function notifyPipelineFailed(options: {
  pipelineRunId: string;
  organizationId: string;
  channelName: string;
  error: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        organizationId: options.organizationId,
        kind: 'pipeline_failed',
        title: 'Generación fallida',
        message: `«${options.channelName}»: ${options.error}`,
        href: `/pipelines/${options.pipelineRunId}`,
        severity: 'error',
      },
    });

    const config = loadConfig();

    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId: options.organizationId, role: 'owner' },
      include: { user: { select: { email: true, name: true, locale: true } } },
    });

    if (!owner?.user.email) return;

    const locale = owner.user.locale === 'en' ? 'en' : 'es';
    const content = buildPipelineFailedEmail({
      userName: owner.user.name,
      channelName: options.channelName,
      error: options.error,
      pipelineUrl: `${config.FRONTEND_URL}/${locale}/pipelines/${options.pipelineRunId}`,
      locale,
    });

    await sendEmail({
      to: owner.user.email,
      templateId: 'pipeline_failed',
      ...content,
    });
  } catch (err) {
    console.warn(
      `[pipeline-notify-failed] No se pudo notificar pipeline=${options.pipelineRunId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
