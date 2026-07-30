---
type: community
cohesion: 0.18
members: 17
---

# lib/notifications.ts

**Cohesion:** 0.18 - loosely connected
**Members:** 17 nodes

## Members
- [[AppNotification_1]] - code - backend/api/src/lib/notifications.ts
- [[CreateNotificationInput]] - code - backend/api/src/lib/notifications.ts
- [[NotificationKind]] - code - backend/api/src/lib/notifications.ts
- [[NotificationSeverity_1]] - code - backend/api/src/lib/notifications.ts
- [[createNotification()]] - code - backend/api/src/lib/notifications.ts
- [[db-errors.ts]] - code - backend/api/src/lib/db-errors.ts
- [[getComputedNotifications()]] - code - backend/api/src/lib/notifications.ts
- [[getOrgNotifications()]] - code - backend/api/src/lib/notifications.ts
- [[getStoredNotifications()]] - code - backend/api/src/lib/notifications.ts
- [[isDbSchemaError()]] - code - backend/api/src/lib/db-errors.ts
- [[libnotifications.ts]] - code - backend/api/src/lib/notifications.ts
- [[markAllNotificationsRead()]] - code - backend/api/src/lib/notifications.ts
- [[markNotificationRead()]] - code - backend/api/src/lib/notifications.ts
- [[notificationsRouter]] - code - backend/api/src/routes/notifications.ts
- [[requireAuth()]] - code - backend/api/src/middleware/auth.ts
- [[routesnotifications.ts]] - code - backend/api/src/routes/notifications.ts
- [[safeNotifications()]] - code - backend/api/src/lib/notifications.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/lib/notificationsts
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_middlewareauth.ts]]
- 3 edges to [[_COMMUNITY_apisrcindex.ts]]
- 1 edge to [[_COMMUNITY_channels.ts]]
- 1 edge to [[_COMMUNITY_routesauth.ts]]

## Top bridge nodes
- [[requireAuth()]] - degree 4, connects to 3 communities
- [[routesnotifications.ts]] - degree 10, connects to 2 communities
- [[getComputedNotifications()]] - degree 3, connects to 1 community
- [[notificationsRouter]] - degree 2, connects to 1 community