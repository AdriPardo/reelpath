---
type: community
cohesion: 0.37
members: 13
---

# pipeline-recovery.ts

**Cohesion:** 0.37 - loosely connected
**Members:** 13 nodes

## Members
- [[TERMINAL_STATUSES]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[finalizePreReviewClipStep()]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[inferResumePayload()]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[isPipelineInProgress()]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[isPipelineStuck()]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[isYouTubeAlreadyPublished()]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[listStuckPipelines()]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[main()_8]] - code - infrastructure/scripts/pipeline-recover-stuck.ts
- [[pipeline-recover-stuck.ts]] - code - infrastructure/scripts/pipeline-recover-stuck.ts
- [[pipeline-recovery.ts]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[recoverAllStuckPipelines()]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[recoverPipelineRun()]] - code - backend/api/src/lib/pipeline-recovery.ts
- [[tryFinalizePreReviewClipStep()]] - code - backend/api/src/lib/pipeline-recovery.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/pipeline-recoveryts
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_videos.ts]]

## Top bridge nodes
- [[pipeline-recovery.ts]] - degree 12, connects to 1 community
- [[recoverPipelineRun()]] - degree 10, connects to 1 community
- [[recoverAllStuckPipelines()]] - degree 6, connects to 1 community
- [[listStuckPipelines()]] - degree 5, connects to 1 community