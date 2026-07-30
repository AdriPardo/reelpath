---
source_file: "backend/services/video-renderer/src/shorts-split.ts"
type: "code"
community: "video-renderer/src/index.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/video-renderer/src/indexts
---

# shorts-split.ts

## Connections
- [[ShortsSplitOptions]] - `contains` [EXTRACTED]
- [[ShortsSplitResult]] - `contains` [EXTRACTED]
- [[SplitInProgressError]] - `contains` [EXTRACTED]
- [[acquireSplitLock()]] - `contains` [EXTRACTED]
- [[applyClipOverlay()]] - `imports` [EXTRACTED]
- [[assertValidVideoFile()]] - `imports` [EXTRACTED]
- [[burnSubtitlesIntoClip()]] - `imports` [EXTRACTED]
- [[cleanShortArtifacts()]] - `contains` [EXTRACTED]
- [[clip-overlay.ts]] - `imports_from` [EXTRACTED]
- [[clip-subtitles.ts]] - `imports_from` [EXTRACTED]
- [[createSingleShortClip()]] - `contains` [EXTRACTED]
- [[expectedShortsPartCount()]] - `contains` [EXTRACTED]
- [[extractShortPart()]] - `contains` [EXTRACTED]
- [[generateVerticalClipThumbnail()]] - `imports` [EXTRACTED]
- [[getVideoDuration()]] - `imports` [EXTRACTED]
- [[isProcessAlive()]] - `contains` [EXTRACTED]
- [[loadPipelineSrt()]] - `imports` [EXTRACTED]
- [[planSegmentDurations()]] - `contains` [EXTRACTED]
- [[selectDistributedSegments()]] - `contains` [EXTRACTED]
- [[splitVideoForShorts()]] - `contains` [EXTRACTED]
- [[subClipPath()]] - `imports` [EXTRACTED]
- [[thumbnail-generator.ts]] - `imports_from` [EXTRACTED]
- [[video-renderersrcffmpeg-utils.ts]] - `imports_from` [EXTRACTED]
- [[video-renderersrcindex.ts]] - `re_exports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/video-renderer/src/indexts