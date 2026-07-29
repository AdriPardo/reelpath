import { Router } from 'express';
import {
  getOrgNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications.js';
import { authMiddleware, orgScope, requireAuth } from '../middleware/auth.js';

export const notificationsRouter = Router();

notificationsRouter.use(authMiddleware, requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.json([]);
  }

  try {
    const items = await getOrgNotifications(orgId, req.auth!.userId);
    res.json(items);
  } catch (err) {
    console.error('[notifications] GET / failed:', err);
    res.status(500).json({ error: 'No se pudieron cargar las notificaciones' });
  }
});

notificationsRouter.patch('/read-all', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Organización no definida' });
  }

  try {
    const updated = await markAllNotificationsRead(orgId, req.auth!.userId);
    res.json({ message: 'Notificaciones marcadas como leídas', updated });
  } catch (err) {
    console.error('[notifications] PATCH /read-all failed:', err);
    res.status(500).json({ error: 'No se pudieron marcar las notificaciones' });
  }
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Organización no definida' });
  }

  try {
    const ok = await markNotificationRead(req.params.id, orgId, req.auth!.userId);
    if (!ok) {
      // IDs sintéticos (review_pending, youtube_token:…) no viven en DB.
      return res.json({ message: 'Notificación descartada', synthetic: true });
    }

    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('[notifications] PATCH /:id/read failed:', err);
    res.status(500).json({ error: 'No se pudo marcar la notificación como leída' });
  }
});
