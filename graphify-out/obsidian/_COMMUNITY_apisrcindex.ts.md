---
type: community
cohesion: 0.10
members: 29
---

# api/src/index.ts

**Cohesion:** 0.10 - loosely connected
**Members:** 29 nodes

## Members
- [[acceptInviteSchema]] - code - backend/api/src/routes/org.ts
- [[apisrcindex.ts]] - code - backend/api/src/index.ts
- [[app]] - code - backend/api/src/index.ts
- [[bootPlatformSecrets()]] - code - backend/api/src/index.ts
- [[channelsRouter]] - code - backend/api/src/routes/channels.ts
- [[config]] - code - backend/api/src/index.ts
- [[dirSizeBytes()]] - code - backend/api/src/lib/storage-stats.ts
- [[formatBytes()]] - code - backend/api/src/lib/storage-stats.ts
- [[getStorageStats()]] - code - backend/api/src/lib/storage-stats.ts
- [[initSentryForApi()]] - code - backend/api/src/lib/sentry.ts
- [[installSentryErrorHandler()]] - code - backend/api/src/lib/sentry.ts
- [[installSentryMiddleware()]] - code - backend/api/src/lib/sentry.ts
- [[integrationsRouter]] - code - backend/api/src/routes/integrations.ts
- [[inviteSchema]] - code - backend/api/src/routes/org.ts
- [[libsentry.ts]] - code - backend/api/src/lib/sentry.ts
- [[optionalApiKey]] - code - backend/api/src/routes/org.ts
- [[optionalVoiceId]] - code - backend/api/src/routes/org.ts
- [[org.ts]] - code - backend/api/src/routes/org.ts
- [[orgRouter]] - code - backend/api/src/routes/org.ts
- [[orgSettingsPatchSchema]] - code - backend/api/src/routes/org.ts
- [[pipelinesRouter]] - code - backend/api/src/routes/pipelines.ts
- [[purgeSchema]] - code - backend/api/src/routes/org.ts
- [[requireAdmin()]] - code - backend/api/src/middleware/auth.ts
- [[serializeMember()]] - code - backend/api/src/routes/org.ts
- [[shutdown()]] - code - backend/api/src/index.ts
- [[storage-stats.ts]] - code - backend/api/src/lib/storage-stats.ts
- [[system.ts]] - code - backend/api/src/routes/system.ts
- [[systemRouter]] - code - backend/api/src/routes/system.ts
- [[videosRouter]] - code - backend/api/src/routes/videos.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/api/src/indexts
SORT file.name ASC
```

## Connections to other communities
- 15 edges to [[_COMMUNITY_middlewareauth.ts]]
- 5 edges to [[_COMMUNITY_stripe-webhook.ts]]
- 5 edges to [[_COMMUNITY_videos.ts]]
- 4 edges to [[_COMMUNITY_channels.ts]]
- 4 edges to [[_COMMUNITY_pipeline-cleanup.ts]]
- 3 edges to [[_COMMUNITY_libnotifications.ts]]
- 2 edges to [[_COMMUNITY_routesauth.ts]]

## Top bridge nodes
- [[apisrcindex.ts]] - degree 36, connects to 6 communities
- [[org.ts]] - degree 18, connects to 3 communities
- [[system.ts]] - degree 10, connects to 3 communities
- [[requireAdmin()]] - degree 5, connects to 2 communities
- [[channelsRouter]] - degree 2, connects to 1 community