---
type: community
cohesion: 0.07
members: 52
---

# videos.ts

**Cohesion:** 0.07 - loosely connected
**Members:** 52 nodes

## Members
- [[dot-constructor()]] - code - backend/api/src/lib/plan-limits.ts
- [[ARCHIVED_REVIEW_STATUSES]] - code - backend/api/src/routes/videos.ts
- [[CANCELLABLE_VIDEO_REVIEW]] - code - backend/api/src/lib/pipeline-cancel.ts
- [[PaginatedResult]] - code - backend/api/src/lib/pagination.ts
- [[PaginationParams]] - code - backend/api/src/lib/pagination.ts
- [[PlanLimitError]] - code - backend/api/src/lib/plan-limits.ts
- [[QueueVideoPublishResult]] - code - backend/api/src/lib/video-publish.ts
- [[VideoAccess]] - code - backend/api/src/routes/videos.ts
- [[approveVideoSchema]] - code - backend/api/src/routes/videos.ts
- [[assertChannelInOrg()]] - code - backend/api/src/lib/tenant.ts
- [[assertPipelineInOrg()]] - code - backend/api/src/routes/pipelines.ts
- [[assertVideoInOrg()]] - code - backend/api/src/lib/tenant.ts
- [[attachVisualSummaries()]] - code - backend/api/src/lib/visual-summary.ts
- [[attachVisualSummary()]] - code - backend/api/src/lib/visual-summary.ts
- [[cancelPipelineRun()]] - code - backend/api/src/lib/pipeline-cancel.ts
- [[checkVideoAccess()]] - code - backend/api/src/routes/videos.ts
- [[deleteSceneAssets()]] - code - backend/api/src/lib/script-editor.ts
- [[enqueueSceneRerender()]] - code - backend/api/src/lib/script-editor.ts
- [[getOrgChannelIds()]] - code - backend/api/src/lib/tenant.ts
- [[isPipelineCancellable()]] - code - backend/api/src/lib/pipeline-cancel.ts
- [[loadScriptVariant()]] - code - backend/api/src/lib/script-editor.ts
- [[normalizeScenes()]] - code - backend/api/src/lib/script-editor.ts
- [[orgChannelIds()]] - code - backend/api/src/middleware/auth.ts
- [[orgChannelWhere()]] - code - backend/api/src/routes/videos.ts
- [[paginatedResponse()]] - code - backend/api/src/lib/pagination.ts
- [[pagination.ts]] - code - backend/api/src/lib/pagination.ts
- [[parsePagination()]] - code - backend/api/src/lib/pagination.ts
- [[patchScriptSchema]] - code - backend/api/src/routes/pipelines.ts
- [[pipeline-cancel.ts]] - code - backend/api/src/lib/pipeline-cancel.ts
- [[pipelines.ts]] - code - backend/api/src/routes/pipelines.ts
- [[planLimitErrorBody()]] - code - backend/api/src/lib/plan-limits.ts
- [[queueVideoYouTubePublish()]] - code - backend/api/src/lib/video-publish.ts
- [[rejectVideoAccess()]] - code - backend/api/src/routes/videos.ts
- [[rescheduleVideoSchema]] - code - backend/api/src/routes/videos.ts
- [[resetPublishPipelineRun()]] - code - backend/api/src/lib/video-publish.ts
- [[resolveVideoFile()]] - code - backend/api/src/lib/video-file.ts
- [[resolveVideoFileAsync()]] - code - backend/api/src/lib/video-file.ts
- [[respondRetryYouTubePublish()]] - code - backend/api/src/routes/videos.ts
- [[retryVideoYouTubePublish()]] - code - backend/api/src/lib/video-publish.ts
- [[scopedChannelFilter()]] - code - backend/api/src/routes/pipelines.ts
- [[script-editor.ts]] - code - backend/api/src/lib/script-editor.ts
- [[streamImageFile()]] - code - backend/api/src/lib/video-file.ts
- [[streamImageFileAsync()]] - code - backend/api/src/lib/video-file.ts
- [[streamVideoFile()]] - code - backend/api/src/lib/video-file.ts
- [[streamVideoFileAsync()]] - code - backend/api/src/lib/video-file.ts
- [[tenant.ts]] - code - backend/api/src/lib/tenant.ts
- [[triggerSchema]] - code - backend/api/src/routes/pipelines.ts
- [[updateVideoSchema]] - code - backend/api/src/routes/videos.ts
- [[video-file.ts]] - code - backend/api/src/lib/video-file.ts
- [[video-publish.ts]] - code - backend/api/src/lib/video-publish.ts
- [[videos.ts]] - code - backend/api/src/routes/videos.ts
- [[visual-summary.ts]] - code - backend/api/src/lib/visual-summary.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/videosts
SORT file.name ASC
```

## Connections to other communities
- 10 edges to [[_COMMUNITY_middlewareauth.ts]]
- 9 edges to [[_COMMUNITY_apisrclibplan-limits.ts]]
- 7 edges to [[_COMMUNITY_channels.ts]]
- 5 edges to [[_COMMUNITY_apisrcindex.ts]]
- 4 edges to [[_COMMUNITY_pipeline-recovery.ts]]
- 4 edges to [[_COMMUNITY_publication-plan.ts]]
- 3 edges to [[_COMMUNITY_pipeline-cleanup.ts]]
- 2 edges to [[_COMMUNITY_routesauth.ts]]

## Top bridge nodes
- [[pipelines.ts]] - degree 36, connects to 6 communities
- [[videos.ts]] - degree 42, connects to 5 communities
- [[tenant.ts]] - degree 8, connects to 2 communities
- [[orgChannelIds()]] - degree 7, connects to 2 communities
- [[assertChannelInOrg()]] - degree 6, connects to 2 communities