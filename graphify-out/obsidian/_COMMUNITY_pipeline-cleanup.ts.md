---
type: community
cohesion: 0.20
members: 18
---

# pipeline-cleanup.ts

**Cohesion:** 0.20 - loosely connected
**Members:** 18 nodes

## Members
- [[args]] - code - infrastructure/scripts/cleanup-storage.ts
- [[cfg]] - code - scripts/retention-cleanup.ts
- [[channel-deletion.ts]] - code - backend/api/src/lib/channel-deletion.ts
- [[cleanup-storage.ts]] - code - infrastructure/scripts/cleanup-storage.ts
- [[cleanupOrphans()]] - code - infrastructure/scripts/cleanup-storage.ts
- [[cleanupPipelineRunStorage()]] - code - backend/api/src/lib/pipeline-cleanup.ts
- [[cleanupRejected()]] - code - infrastructure/scripts/cleanup-storage.ts
- [[cutoff]] - code - scripts/retention-cleanup.ts
- [[deleteChannelWithCleanup()]] - code - backend/api/src/lib/channel-deletion.ts
- [[deletePipelineRunCompletely()]] - code - backend/api/src/lib/pipeline-cleanup.ts
- [[deleteVideoLocalFilesOnly()]] - code - backend/api/src/lib/pipeline-cleanup.ts
- [[main()_7]] - code - infrastructure/scripts/cleanup-storage.ts
- [[main()_20]] - code - scripts/retention-cleanup.ts
- [[pipeline-cleanup.ts]] - code - backend/api/src/lib/pipeline-cleanup.ts
- [[retention-cleanup.ts]] - code - scripts/retention-cleanup.ts
- [[retentionDays]] - code - scripts/retention-cleanup.ts
- [[rmDirQuiet()]] - code - backend/api/src/lib/pipeline-cleanup.ts
- [[unlinkQuiet()]] - code - backend/api/src/lib/pipeline-cleanup.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/pipeline-cleanupts
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_apisrcindex.ts]]
- 3 edges to [[_COMMUNITY_videos.ts]]
- 2 edges to [[_COMMUNITY_channels.ts]]

## Top bridge nodes
- [[pipeline-cleanup.ts]] - degree 10, connects to 2 communities
- [[deletePipelineRunCompletely()]] - degree 6, connects to 2 communities
- [[channel-deletion.ts]] - degree 5, connects to 2 communities
- [[deleteChannelWithCleanup()]] - degree 4, connects to 2 communities
- [[deleteVideoLocalFilesOnly()]] - degree 4, connects to 1 community