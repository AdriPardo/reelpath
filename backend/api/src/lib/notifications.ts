import { prisma } from '@autotube/database';
import { isDbSchemaError } from './db-errors.js';

export type NotificationKind =
  | 'review_pending'
  | 'pipeline_failed'
  | 'pipeline_completed'
  | 'youtube_token_expired';

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  severity: NotificationSeverity;
  read: boolean;
  persistent: boolean;
}

export interface CreateNotificationInput {
  organizationId: string;
  userId?: string | null;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string;
  severity?: NotificationSeverity;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      kind: input.kind,
      title: input.title,
      message: input.message,
      href: input.href,
      severity: input.severity ?? 'info',
    },
  });
}

async function getStoredNotifications(
  orgId: string,
  userId: string,
): Promise<AppNotification[]> {
  const rows = await prisma.notification.findMany({
    where: {
      organizationId: orgId,
      readAt: null,
      OR: [{ userId: null }, { userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    message: row.message,
    href: row.href,
    createdAt: row.createdAt.toISOString(),
    severity: row.severity as NotificationSeverity,
    read: false,
    persistent: true,
  }));
}

async function getComputedNotifications(orgId: string): Promise<AppNotification[]> {
  const channels = await prisma.channel.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  });
  const channelIds = channels.map((c) => c.id);

  if (channelIds.length === 0) return [];

  const notifications: AppNotification[] = [];
  const now = new Date().toISOString();

  const pendingCount = await prisma.video.count({
    where: { channelId: { in: channelIds }, reviewStatus: 'pending' },
  });
  if (pendingCount > 0) {
    notifications.push({
      id: 'review_pending',
      kind: 'review_pending',
      title: 'Vídeos pendientes de revisión',
      message:
        pendingCount === 1
          ? 'Tienes 1 vídeo esperando tu aprobación.'
          : `Tienes ${pendingCount} vídeos esperando tu aprobación.`,
      href: '/review',
      createdAt: now,
      severity: 'info',
      read: false,
      persistent: false,
    });
  }

  const { getIntegrationsSummaryForChannels } = await import('./channel-integrations.js');
  const summaries = await getIntegrationsSummaryForChannels(channelIds);
  const channelNameById = new Map(channels.map((c) => [c.id, c.name]));

  for (const channelId of channelIds) {
    const yt = summaries[channelId]?.youtube;
    if (yt?.connected && !yt.tokenOk) {
      notifications.push({
        id: `youtube_token:${channelId}`,
        kind: 'youtube_token_expired',
        title: 'Reconectar YouTube',
        message: `El token de «${channelNameById.get(channelId) ?? 'canal'}» ha expirado o es inválido.`,
        href: `/channels/${channelId}?tab=integraciones`,
        createdAt: now,
        severity: 'warning',
        read: false,
        persistent: false,
      });
    }
  }

  return notifications;
}

async function safeNotifications(
  fn: () => Promise<AppNotification[]>,
): Promise<AppNotification[]> {
  try {
    return await fn();
  } catch (err) {
    if (isDbSchemaError(err)) return [];
    throw err;
  }
}

export async function getOrgNotifications(
  orgId: string,
  userId: string,
): Promise<AppNotification[]> {
  const [stored, computed] = await Promise.all([
    safeNotifications(() => getStoredNotifications(orgId, userId)),
    safeNotifications(() => getComputedNotifications(orgId)),
  ]);

  return [...stored, ...computed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationRead(
  notificationId: string,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const row = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      organizationId: orgId,
      OR: [{ userId: null }, { userId }],
    },
  });
  if (!row) return false;

  await prisma.notification.update({
    where: { id: row.id },
    data: { readAt: new Date() },
  });
  return true;
}

export async function markAllNotificationsRead(
  orgId: string,
  userId: string,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      organizationId: orgId,
      readAt: null,
      OR: [{ userId: null }, { userId }],
    },
    data: { readAt: new Date() },
  });
  return result.count;
}
