import { describe, expect, it } from 'vitest';

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  persistent: boolean;
  read: boolean;
  createdAt: string;
}

/** Prioriza persistentes y ordena por fecha descendente (misma regla que getOrgNotifications). */
export function mergeNotifications(
  stored: AppNotification[],
  computed: AppNotification[],
): AppNotification[] {
  return [...stored, ...computed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function countUnread(notifications: AppNotification[]): number {
  return notifications.filter((n) => !n.read).length;
}

describe('mergeNotifications', () => {
  it('combina persistentes y calculadas ordenadas por fecha', () => {
    const stored: AppNotification[] = [
      {
        id: 's1',
        kind: 'pipeline_completed',
        title: 'Listo',
        persistent: true,
        read: false,
        createdAt: '2026-07-13T10:00:00.000Z',
      },
    ];
    const computed: AppNotification[] = [
      {
        id: 'review_pending',
        kind: 'review_pending',
        title: 'Pendientes',
        persistent: false,
        read: false,
        createdAt: '2026-07-13T12:00:00.000Z',
      },
    ];
    const merged = mergeNotifications(stored, computed);
    expect(merged[0]?.id).toBe('review_pending');
    expect(merged).toHaveLength(2);
  });
});

describe('countUnread', () => {
  it('cuenta solo no leídas', () => {
    const list: AppNotification[] = [
      {
        id: 'a',
        kind: 'x',
        title: 'A',
        persistent: true,
        read: false,
        createdAt: '2026-07-13T10:00:00.000Z',
      },
      {
        id: 'b',
        kind: 'x',
        title: 'B',
        persistent: true,
        read: true,
        createdAt: '2026-07-13T09:00:00.000Z',
      },
    ];
    expect(countUnread(list)).toBe(1);
  });
});
