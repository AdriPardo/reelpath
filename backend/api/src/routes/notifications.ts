import { Router } from 'express';
import { getOrgNotifications, markNotificationRead } from '../lib/notifications.js';
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

notificationsRouter.patch('/:id/read', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.status(400).json({ error: 'Organización no definida' });
  }

  try {
    const ok = await markNotificationRead(req.params.id, orgId, req.auth!.userId);
    if (!ok) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('[notifications] PATCH /:id/read failed:', err);
    res.status(500).json({ error: 'No se pudo marcar la notificación como leída' });
  }
});
