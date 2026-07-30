---
type: community
cohesion: 0.11
members: 33
---

# middleware/auth.ts

**Cohesion:** 0.11 - loosely connected
**Members:** 33 nodes

## Members
- [[ApiLocale]] - code - backend/api/src/lib/i18n.ts
- [[AuthContext]] - code - backend/api/src/lib/auth.ts
- [[Express_2]] - code - backend/api/src/middleware/auth.ts
- [[JwtPayload]] - code - backend/api/src/lib/auth.ts
- [[MemberRole]] - code - backend/api/src/lib/auth.ts
- [[Request]] - code - backend/api/src/middleware/auth.ts
- [[analyticsRouter]] - code - backend/api/src/routes/analytics.ts
- [[apisrclibauth.ts]] - code - backend/api/src/lib/auth.ts
- [[attachUserLocale()]] - code - backend/api/src/middleware/auth.ts
- [[attachUserLocaleMiddleware()]] - code - backend/api/src/middleware/auth.ts
- [[authMiddleware()]] - code - backend/api/src/middleware/auth.ts
- [[enforceAuthMiddleware()]] - code - backend/api/src/middleware/auth.ts
- [[extractAuthToken()]] - code - backend/api/src/middleware/auth.ts
- [[extractBearer()]] - code - backend/api/src/middleware/observability-auth.ts
- [[extractBearerToken()]] - code - backend/api/src/middleware/auth.ts
- [[extractCookieToken()]] - code - backend/api/src/middleware/auth.ts
- [[extractCookieToken()_1]] - code - backend/api/src/middleware/observability-auth.ts
- [[getAuthSecretKey()]] - code - backend/api/src/lib/auth.ts
- [[hashPassword()]] - code - backend/api/src/lib/auth.ts
- [[isAdminRole()]] - code - backend/api/src/lib/auth.ts
- [[middlewareauth.ts]] - code - backend/api/src/middleware/auth.ts
- [[observability-auth.ts]] - code - backend/api/src/middleware/observability-auth.ts
- [[orgScope()]] - code - backend/api/src/middleware/auth.ts
- [[parseAuthMiddleware()]] - code - backend/api/src/middleware/auth.ts
- [[patchSchema_1]] - code - backend/api/src/routes/platform.ts
- [[platform.ts]] - code - backend/api/src/routes/platform.ts
- [[platformRouter]] - code - backend/api/src/routes/platform.ts
- [[requireObservabilityAccess()]] - code - backend/api/src/middleware/observability-auth.ts
- [[requireOwner()]] - code - backend/api/src/middleware/auth.ts
- [[routesanalytics.ts]] - code - backend/api/src/routes/analytics.ts
- [[signToken()]] - code - backend/api/src/lib/auth.ts
- [[verifyPassword()]] - code - backend/api/src/lib/auth.ts
- [[verifyToken()]] - code - backend/api/src/lib/auth.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/middleware/authts
SORT file.name ASC
```

## Connections to other communities
- 15 edges to [[_COMMUNITY_apisrcindex.ts]]
- 11 edges to [[_COMMUNITY_channels.ts]]
- 10 edges to [[_COMMUNITY_videos.ts]]
- 8 edges to [[_COMMUNITY_routesauth.ts]]
- 4 edges to [[_COMMUNITY_apisrclibplan-limits.ts]]
- 4 edges to [[_COMMUNITY_libnotifications.ts]]
- 3 edges to [[_COMMUNITY_stripe-webhook.ts]]

## Top bridge nodes
- [[middlewareauth.ts]] - degree 32, connects to 7 communities
- [[authMiddleware()]] - degree 14, connects to 5 communities
- [[orgScope()]] - degree 10, connects to 5 communities
- [[apisrclibauth.ts]] - degree 14, connects to 3 communities
- [[platform.ts]] - degree 8, connects to 2 communities