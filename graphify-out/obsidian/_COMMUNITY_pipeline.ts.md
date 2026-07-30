---
type: community
cohesion: 0.12
members: 32
---

# pipeline.ts

**Cohesion:** 0.12 - loosely connected
**Members:** 32 nodes

## Members
- [[DedicatedShortResult]] - code - worker/src/dedicated-short.ts
- [[GenerateDedicatedShortOptions]] - code - worker/src/dedicated-short.ts
- [[SHORT_ANGLE_HINTS]] - code - worker/src/dedicated-short.ts
- [[buildTeaserClip()]] - code - worker/src/dedicated-short.ts
- [[captureWorkerError()]] - code - worker/src/sentry.ts
- [[dedicated-short.ts]] - code - worker/src/dedicated-short.ts
- [[enqueueAfterClipSplit()]] - code - worker/src/pipeline.ts
- [[ensureLongSplitBeforeDedicated()]] - code - worker/src/pipeline.ts
- [[finalizePreReviewClipStep()_1]] - code - worker/src/pipeline.ts
- [[generateDedicatedShort()]] - code - worker/src/dedicated-short.ts
- [[initSentryForWorker()]] - code - worker/src/sentry.ts
- [[isUploadPipeline()]] - code - worker/src/pipeline.ts
- [[isYouTubeAlreadyPublished()_1]] - code - worker/src/pipeline.ts
- [[needsVerticalClipSplit()_1]] - code - worker/src/pipeline.ts
- [[notifyPipelineFailed()]] - code - worker/src/pipeline-notify-failed.ts
- [[notifyPipelineReadyForReview()]] - code - worker/src/pipeline-notify.ts
- [[pipeline-notify-failed.ts]] - code - worker/src/pipeline-notify-failed.ts
- [[pipeline-notify.ts]] - code - worker/src/pipeline-notify.ts
- [[pipeline.ts]] - code - worker/src/pipeline.ts
- [[processPipelineJob()]] - code - worker/src/pipeline.ts
- [[resolveShortsCount()]] - code - worker/src/dedicated-short.ts
- [[resumeAfterApproval()]] - code - worker/src/pipeline.ts
- [[runPipelineStep()]] - code - worker/src/pipeline.ts
- [[shutdown()_1]] - code - worker/src/index.ts
- [[srcsentry.ts]] - code - worker/src/sentry.ts
- [[updatePipelineStatus()]] - code - worker/src/pipeline.ts
- [[usesDedicatedShort()]] - code - worker/src/pipeline.ts
- [[usesMixedShorts()]] - code - worker/src/pipeline.ts
- [[verticalClipStep()]] - code - worker/src/pipeline.ts
- [[wantsYoutubeShortsClips()]] - code - worker/src/pipeline.ts
- [[worker_1]] - code - worker/src/index.ts
- [[workersrcindex.ts]] - code - worker/src/index.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/pipelinets
SORT file.name ASC
```
