import { Router } from 'express';
import { getChannelAnalytics, getOrgAnalyticsSummary } from '@autotube/analytics';
import { assertChannelInOrg } from '../lib/tenant.js';
import { authMiddleware, orgScope } from '../middleware/auth.js';

export const analyticsRouter = Router();

analyticsRouter.use(authMiddleware);

analyticsRouter.get('/org-summary', async (req, res) => {
  const orgId = orgScope(req);
  if (!orgId) {
    return res.json({
      totalViews: 0,
      videoCount: 0,
      channelCount: 0,
      hasMockData: false,
      avgCtr: null,
      avgRetention: null,
      engagementSampleCount: 0,
      topVideos: [],
    });
  }
  const data = await getOrgAnalyticsSummary(orgId);
  res.json(data);
});

analyticsRouter.get('/channels/:channelId', async (req, res) => {
  const orgId = orgScope(req);
  if (orgId && !(await assertChannelInOrg(req.params.channelId, orgId))) {
    return res.status(404).json({ error: 'Channel not found' });
  }
  const data = await getChannelAnalytics(req.params.channelId);
  res.json(data);
});
