---
type: community
cohesion: 0.12
members: 31
---

# api/src/lib/plan-limits.ts

**Cohesion:** 0.12 - loosely connected
**Members:** 31 nodes

## Members
- [[MessageTree]] - code - backend/api/src/lib/i18n.ts
- [[PROMPTS]] - code - backend/core/database/prisma/seed.js
- [[PlanLimits]] - code - backend/api/src/lib/plan-limits.ts
- [[TEMPLATES]] - code - backend/core/database/prisma/seed.js
- [[apisrclibi18n.ts]] - code - backend/api/src/lib/i18n.ts
- [[apisrclibplan-limits.ts]] - code - backend/api/src/lib/plan-limits.ts
- [[assertOrgCanPublish()]] - code - backend/api/src/lib/plan-limits.ts
- [[assertOrgCanTriggerPipeline()]] - code - backend/api/src/lib/plan-limits.ts
- [[assertTrialActive()]] - code - backend/api/src/lib/plan-limits.ts
- [[catalogs]] - code - backend/api/src/lib/i18n.ts
- [[coerceLimits()]] - code - backend/api/src/lib/plan-limits.ts
- [[countOrgPipelinesToday()]] - code - backend/api/src/lib/plan-limits.ts
- [[countOrgVideosThisMonth()]] - code - backend/api/src/lib/plan-limits.ts
- [[i18n.test.ts]] - code - backend/api/src/lib/i18n.test.ts
- [[index_js_1]] - code - backend/core/database/prisma/seed.js
- [[interpolate()]] - code - backend/api/src/lib/i18n.ts
- [[isTrialExpired()]] - code - backend/api/src/lib/plan-limits.ts
- [[loadOrgBilling()]] - code - backend/api/src/lib/plan-limits.ts
- [[localeFromRequest()]] - code - backend/api/src/lib/request-locale.ts
- [[main()]] - code - backend/core/database/prisma/seed.js
- [[parseAcceptLanguage()]] - code - backend/api/src/lib/i18n.ts
- [[plan-limits.test.ts]] - code - backend/api/src/lib/plan-limits.test.ts
- [[request-locale.ts]] - code - backend/api/src/lib/request-locale.ts
- [[resolveKey()]] - code - backend/api/src/lib/i18n.ts
- [[resolveLocale()]] - code - backend/api/src/lib/i18n.ts
- [[resolveOrgPlanLimits()]] - code - backend/api/src/lib/plan-limits.ts
- [[seed.js]] - code - backend/core/database/prisma/seed.js
- [[startOfUtcDay()]] - code - backend/api/src/lib/plan-limits.ts
- [[startOfUtcMonth()]] - code - backend/api/src/lib/plan-limits.ts
- [[t()]] - code - backend/api/src/lib/i18n.ts
- [[trialDaysRemaining()]] - code - backend/api/src/lib/plan-limits.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/api/src/lib/plan-limitsts
SORT file.name ASC
```

## Connections to other communities
- 9 edges to [[_COMMUNITY_videos.ts]]
- 4 edges to [[_COMMUNITY_middlewareauth.ts]]
- 3 edges to [[_COMMUNITY_routesauth.ts]]
- 3 edges to [[_COMMUNITY_channels.ts]]
- 2 edges to [[_COMMUNITY_stripe-webhook.ts]]
- 1 edge to [[_COMMUNITY_seed.ts]]
- 1 edge to [[_COMMUNITY_help-search.ts]]
- 1 edge to [[_COMMUNITY_databasesrcindex.ts]]

## Top bridge nodes
- [[apisrclibplan-limits.ts]] - degree 23, connects to 4 communities
- [[apisrclibi18n.ts]] - degree 14, connects to 2 communities
- [[t()]] - degree 11, connects to 2 communities
- [[assertOrgCanTriggerPipeline()]] - degree 9, connects to 2 communities
- [[request-locale.ts]] - degree 5, connects to 2 communities