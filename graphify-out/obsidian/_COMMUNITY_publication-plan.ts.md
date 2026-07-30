---
type: community
cohesion: 0.30
members: 12
---

# publication-plan.ts

**Cohesion:** 0.30 - loosely connected
**Members:** 12 nodes

## Members
- [[PublicationPlanEntryWithMeta]] - code - backend/api/src/lib/publication-plan.ts
- [[PublicationPlanResponse]] - code - backend/api/src/lib/publication-plan.ts
- [[applyChannelPublicationPlan()]] - code - backend/api/src/lib/publication-plan.ts
- [[fetchChannelScheduledLongDates()]] - code - backend/api/src/lib/publication-plan.ts
- [[getChannelPublicationPlan()]] - code - backend/api/src/lib/publication-plan.ts
- [[previewNextPublishSlot()]] - code - backend/api/src/lib/publication-plan.ts
- [[publication-plan.ts]] - code - backend/api/src/lib/publication-plan.ts
- [[publicationPlanVideoWhere()]] - code - backend/api/src/lib/video-schedule-reconcile.ts
- [[reconcileOverdueYoutubeScheduledVideos()]] - code - backend/api/src/lib/video-schedule-reconcile.ts
- [[resolveChannelAutoPublishAt()]] - code - backend/api/src/lib/publication-plan.ts
- [[video-schedule-reconcile.test.ts]] - code - backend/api/src/lib/video-schedule-reconcile.test.ts
- [[video-schedule-reconcile.ts]] - code - backend/api/src/lib/video-schedule-reconcile.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/publication-plants
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_videos.ts]]

## Top bridge nodes
- [[publication-plan.ts]] - degree 12, connects to 1 community
- [[resolveChannelAutoPublishAt()]] - degree 4, connects to 1 community