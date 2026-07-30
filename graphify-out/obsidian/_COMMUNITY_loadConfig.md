---
type: community
cohesion: 0.28
members: 15
---

# loadConfig

**Cohesion:** 0.28 - loosely connected
**Members:** 15 nodes

## Members
- [[StorageBackend]] - code - backend/core/config-system/src/storage.ts
- [[ensureLocalFile()]] - code - backend/core/config-system/src/storage.ts
- [[getOpenAiMaxTokens()]] - code - backend/core/config-system/src/index.ts
- [[getPublicMediaUrl()]] - code - backend/core/config-system/src/storage.ts
- [[getS3Client()]] - code - backend/core/config-system/src/storage.ts
- [[getStorageBackend()]] - code - backend/core/config-system/src/storage.ts
- [[getStoragePath()]] - code - backend/core/config-system/src/index.ts
- [[guessContentType()]] - code - backend/core/config-system/src/storage.ts
- [[isS3Configured()]] - code - backend/core/config-system/src/storage.ts
- [[loadConfig()]] - code - backend/core/config-system/src/index.ts
- [[mirrorToS3IfConfigured()]] - code - backend/core/config-system/src/storage.ts
- [[resolveLocalStoragePath()]] - code - backend/core/config-system/src/storage.ts
- [[storage.ts]] - code - backend/core/config-system/src/storage.ts
- [[validateProductionConfig()]] - code - backend/core/config-system/src/index.ts
- [[writeStorageFile()]] - code - backend/core/config-system/src/storage.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/loadConfig
SORT file.name ASC
```

## Connections to other communities
- 13 edges to [[_COMMUNITY_config-systemsrcindex.ts]]
- 9 edges to [[_COMMUNITY_getOrgPipelineOverrides]]
- 3 edges to [[_COMMUNITY_email.ts]]
- 1 edge to [[_COMMUNITY_resolve-settings.ts]]

## Top bridge nodes
- [[loadConfig()]] - degree 24, connects to 4 communities
- [[storage.ts]] - degree 12, connects to 1 community
- [[mirrorToS3IfConfigured()]] - degree 7, connects to 1 community
- [[ensureLocalFile()]] - degree 6, connects to 1 community
- [[isS3Configured()]] - degree 6, connects to 1 community