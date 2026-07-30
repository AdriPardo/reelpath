---
type: community
cohesion: 0.08
members: 48
---

# channels.ts

**Cohesion:** 0.08 - loosely connected
**Members:** 48 nodes

## Members
- [[ChannelIntegrationsResponse]] - code - backend/api/src/lib/channel-integrations.ts
- [[IntegrationProvider]] - code - backend/api/src/lib/channel-integrations.ts
- [[IntegrationProviderStatus]] - code - backend/api/src/lib/channel-integrations.ts
- [[IntegrationSummary]] - code - backend/api/src/lib/channel-integrations.ts
- [[PIPELINE_IDLE_STATUSES]] - code - backend/api/src/routes/channels.ts
- [[UploadLongVideoParams]] - code - backend/api/src/lib/upload-long.ts
- [[UploadLongVideoResult]] - code - backend/api/src/lib/upload-long.ts
- [[VideoProbeResult]] - code - backend/api/src/lib/upload-long.ts
- [[YOUTUBE_OAUTH_SCOPES]] - code - backend/api/src/lib/youtube-oauth.ts
- [[YouTubeCredentialData]] - code - backend/api/src/lib/channel-integrations.ts
- [[YouTubeOAuthState]] - code - backend/api/src/lib/youtube-oauth.ts
- [[buildCredentialFromEnv()]] - code - backend/api/src/lib/channel-integrations.ts
- [[buildYouTubeAuthUrl()]] - code - backend/api/src/lib/youtube-oauth.ts
- [[cacheDel()]] - code - backend/api/src/lib/redis-cache.ts
- [[cacheDelPattern()]] - code - backend/api/src/lib/redis-cache.ts
- [[cacheGet()]] - code - backend/api/src/lib/redis-cache.ts
- [[cacheSet()]] - code - backend/api/src/lib/redis-cache.ts
- [[channel-integrations.ts]] - code - backend/api/src/lib/channel-integrations.ts
- [[channels.ts]] - code - backend/api/src/routes/channels.ts
- [[checkYouTubeStatus()]] - code - backend/api/src/lib/channel-integrations.ts
- [[createSchema]] - code - backend/api/src/routes/channels.ts
- [[createYouTubeOAuth2Client()]] - code - backend/api/src/lib/youtube-oauth.ts
- [[deleteChannelCredential()]] - code - backend/api/src/lib/channel-integrations.ts
- [[envYouTubeData()]] - code - backend/api/src/lib/channel-integrations.ts
- [[exchangeYouTubeAuthCode()]] - code - backend/api/src/lib/youtube-oauth.ts
- [[execFileAsync]] - code - backend/api/src/lib/upload-long.ts
- [[getChannelIntegrations()]] - code - backend/api/src/lib/channel-integrations.ts
- [[getIntegrationsSummaryForChannels()]] - code - backend/api/src/lib/channel-integrations.ts
- [[getOAuthStateKey()]] - code - backend/api/src/lib/youtube-oauth.ts
- [[getRedis()]] - code - backend/api/src/lib/redis-cache.ts
- [[getYouTubeOAuthRedirectUri()]] - code - backend/api/src/lib/youtube-oauth.ts
- [[handleLongVideoUpload()]] - code - backend/api/src/lib/upload-long.ts
- [[hasYouTubeOAuthApp()]] - code - backend/api/src/lib/youtube-oauth.ts
- [[integrationProviders]] - code - backend/api/src/routes/channels.ts
- [[integrations.ts]] - code - backend/api/src/routes/integrations.ts
- [[invalidateChannelIntegrationsCache()]] - code - backend/api/src/lib/channel-integrations.ts
- [[libyoutube-oauth.ts]] - code - backend/api/src/lib/youtube-oauth.ts
- [[patchIntegrationSchema]] - code - backend/api/src/routes/channels.ts
- [[patchSchema]] - code - backend/api/src/routes/channels.ts
- [[probeVideoFile()]] - code - backend/api/src/lib/upload-long.ts
- [[redis-cache.ts]] - code - backend/api/src/lib/redis-cache.ts
- [[resolveYouTubeCredentials()]] - code - backend/api/src/lib/channel-integrations.ts
- [[signYouTubeOAuthState()]] - code - backend/api/src/lib/youtube-oauth.ts
- [[upload]] - code - backend/api/src/routes/channels.ts
- [[upload-long.ts]] - code - backend/api/src/lib/upload-long.ts
- [[upsertChannelCredential()]] - code - backend/api/src/lib/channel-integrations.ts
- [[verifyYouTubeOAuthState()]] - code - backend/api/src/lib/youtube-oauth.ts
- [[ytIntegrationCacheKey()]] - code - backend/api/src/lib/channel-integrations.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/channelsts
SORT file.name ASC
```

## Connections to other communities
- 11 edges to [[_COMMUNITY_middlewareauth.ts]]
- 7 edges to [[_COMMUNITY_videos.ts]]
- 4 edges to [[_COMMUNITY_apisrcindex.ts]]
- 3 edges to [[_COMMUNITY_apisrclibplan-limits.ts]]
- 2 edges to [[_COMMUNITY_channel-compliance.ts]]
- 2 edges to [[_COMMUNITY_pipeline-cleanup.ts]]
- 1 edge to [[_COMMUNITY_libnotifications.ts]]

## Top bridge nodes
- [[channels.ts]] - degree 39, connects to 6 communities
- [[integrations.ts]] - degree 12, connects to 2 communities
- [[channel-integrations.ts]] - degree 24, connects to 1 community
- [[libyoutube-oauth.ts]] - degree 16, connects to 1 community
- [[getOAuthStateKey()]] - degree 4, connects to 1 community