---
type: community
cohesion: 0.12
members: 25
---

# routes/auth.ts

**Cohesion:** 0.12 - loosely connected
**Members:** 25 nodes

## Members
- [[apisrclibauth-cookie.ts]] - code - backend/api/src/lib/auth-cookie.ts
- [[authRateLimiter]] - code - backend/api/src/middleware/rate-limit.ts
- [[authRouter]] - code - backend/api/src/routes/auth.ts
- [[billing-email.ts]] - code - backend/api/src/lib/billing-email.ts
- [[clearAuthCookies()]] - code - backend/api/src/lib/auth-cookie.ts
- [[cookieSecure()]] - code - backend/api/src/lib/auth-cookie.ts
- [[deriveOrganizationName()]] - code - backend/api/src/routes/auth.ts
- [[ensureUniqueOrgSlug()]] - code - backend/api/src/routes/auth.ts
- [[loginSchema]] - code - backend/api/src/routes/auth.ts
- [[maybeSendTrialEndingEmail()]] - code - backend/api/src/lib/billing-email.ts
- [[normalizeEmailLocale()]] - code - backend/api/src/lib/billing-email.ts
- [[normalizeLocale()]] - code - backend/api/src/routes/auth.ts
- [[notifyPaymentFailed()]] - code - backend/api/src/lib/billing-email.ts
- [[pipelineTriggerRateLimiter]] - code - backend/api/src/middleware/rate-limit.ts
- [[randomSlugSuffix()]] - code - backend/api/src/routes/auth.ts
- [[rate-limit.ts]] - code - backend/api/src/middleware/rate-limit.ts
- [[registerSchema]] - code - backend/api/src/routes/auth.ts
- [[routesauth.ts]] - code - backend/api/src/routes/auth.ts
- [[serializeAuthCookie()]] - code - backend/api/src/lib/auth-cookie.ts
- [[serializeOrganization()]] - code - backend/api/src/routes/auth.ts
- [[serializeUser()]] - code - backend/api/src/routes/auth.ts
- [[setAuthCookies()]] - code - backend/api/src/lib/auth-cookie.ts
- [[slugify()]] - code - backend/api/src/routes/auth.ts
- [[trialReminderSent]] - code - backend/api/src/lib/billing-email.ts
- [[updateMeSchema]] - code - backend/api/src/routes/auth.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/routes/authts
SORT file.name ASC
```

## Connections to other communities
- 8 edges to [[_COMMUNITY_middlewareauth.ts]]
- 3 edges to [[_COMMUNITY_apisrclibplan-limits.ts]]
- 2 edges to [[_COMMUNITY_apisrcindex.ts]]
- 2 edges to [[_COMMUNITY_stripe-webhook.ts]]
- 2 edges to [[_COMMUNITY_videos.ts]]
- 1 edge to [[_COMMUNITY_libnotifications.ts]]

## Top bridge nodes
- [[routesauth.ts]] - degree 29, connects to 4 communities
- [[billing-email.ts]] - degree 9, connects to 3 communities
- [[rate-limit.ts]] - degree 4, connects to 1 community
- [[pipelineTriggerRateLimiter]] - degree 2, connects to 1 community
- [[authRouter]] - degree 2, connects to 1 community