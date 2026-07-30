---
type: community
cohesion: 0.11
members: 32
---

# analytics/src/index.ts

**Cohesion:** 0.11 - loosely connected
**Members:** 32 nodes

## Members
- [[MetricsSource]] - code - backend/services/analytics/src/index.ts
- [[OrgAnalyticsSummary]] - code - backend/services/analytics/src/org-analytics.ts
- [[OrgAnalyticsTopVideo]] - code - backend/services/analytics/src/org-analytics.ts
- [[SyncVideoAnalyticsResult]] - code - backend/services/analytics/src/index.ts
- [[VideoMetrics]] - code - backend/services/analytics/src/types.ts
- [[YouTubeMetricsResult]] - code - backend/services/analytics/src/youtube-analytics.ts
- [[analyticssrcindex.ts]] - code - backend/services/analytics/src/index.ts
- [[analyticssrctypes.ts]] - code - backend/services/analytics/src/types.ts
- [[buildMockVideoMetrics()]] - code - backend/services/analytics/src/youtube-analytics.ts
- [[buildRetentionByPublishHour()]] - code - backend/services/analytics/src/retention-by-hour.ts
- [[buildSummaryFromSnapshots()]] - code - backend/services/analytics/src/index.ts
- [[clamp01()]] - code - backend/services/analytics/src/youtube-analytics.ts
- [[fetchYouTubeVideoMetrics()]] - code - backend/services/analytics/src/youtube-analytics.ts
- [[formatYmd()]] - code - backend/services/analytics/src/youtube-analytics.ts
- [[getChannelAnalytics()]] - code - backend/services/analytics/src/index.ts
- [[getChannelAnalyticsInsights()]] - code - backend/services/analytics/src/index.ts
- [[getChannelYouTubeAnalytics()]] - code - backend/services/analytics/src/index.ts
- [[getOrgAnalyticsSummary()]] - code - backend/services/analytics/src/org-analytics.ts
- [[getVideoYouTubeAnalytics()]] - code - backend/services/analytics/src/index.ts
- [[getZonedHour()]] - code - backend/services/analytics/src/retention-by-hour.ts
- [[isRealYouTubeId()]] - code - backend/services/analytics/src/index.ts
- [[metricsSource()]] - code - backend/services/analytics/src/org-analytics.ts
- [[org-analytics.ts]] - code - backend/services/analytics/src/org-analytics.ts
- [[parseReportRow()]] - code - backend/services/analytics/src/youtube-analytics.ts
- [[persistSnapshot()]] - code - backend/services/analytics/src/index.ts
- [[probeYouTubeAnalyticsAccess()]] - code - backend/services/analytics/src/youtube-analytics.ts
- [[reportHasData()]] - code - backend/services/analytics/src/youtube-analytics.ts
- [[resolveMetrics()]] - code - backend/services/analytics/src/index.ts
- [[retention-by-hour.ts]] - code - backend/services/analytics/src/retention-by-hour.ts
- [[syncChannelYouTubeAnalytics()]] - code - backend/services/analytics/src/index.ts
- [[syncVideoAnalytics()]] - code - backend/services/analytics/src/index.ts
- [[youtube-analytics.ts]] - code - backend/services/analytics/src/youtube-analytics.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/analytics/src/indexts
SORT file.name ASC
```
