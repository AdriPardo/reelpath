---
type: community
cohesion: 0.17
members: 20
---

# email.ts

**Cohesion:** 0.17 - loosely connected
**Members:** 20 nodes

## Members
- [[EmailLocale]] - code - backend/core/config-system/src/email.ts
- [[EmailTemplateId]] - code - backend/core/config-system/src/email.ts
- [[SendEmailParams]] - code - backend/core/config-system/src/email.ts
- [[SendEmailResult]] - code - backend/core/config-system/src/email.ts
- [[buildOrgInviteEmail()]] - code - backend/core/config-system/src/email.ts
- [[buildPaymentFailedEmail()]] - code - backend/core/config-system/src/email.ts
- [[buildPipelineCompletedEmail()]] - code - backend/core/config-system/src/email.ts
- [[buildPipelineFailedEmail()]] - code - backend/core/config-system/src/email.ts
- [[buildTrialEndingEmail()]] - code - backend/core/config-system/src/email.ts
- [[buildWelcomeEmail()]] - code - backend/core/config-system/src/email.ts
- [[email.ts]] - code - backend/core/config-system/src/email.ts
- [[emailGreeting()]] - code - backend/core/config-system/src/email.ts
- [[getSmtpTransporter()]] - code - backend/core/config-system/src/email.ts
- [[isBrevoConfigured()]] - code - backend/core/config-system/src/email.ts
- [[isEmailConfigured()]] - code - backend/core/config-system/src/email.ts
- [[isSmtpConfigured()]] - code - backend/core/config-system/src/email.ts
- [[parseEmailFrom()]] - code - backend/core/config-system/src/email.ts
- [[sendEmail()]] - code - backend/core/config-system/src/email.ts
- [[sendViaBrevo()]] - code - backend/core/config-system/src/email.ts
- [[sendViaSmtp()]] - code - backend/core/config-system/src/email.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/emailts
SORT file.name ASC
```

## Connections to other communities
- 12 edges to [[_COMMUNITY_config-systemsrcindex.ts]]
- 3 edges to [[_COMMUNITY_loadConfig]]

## Top bridge nodes
- [[email.ts]] - degree 21, connects to 2 communities
- [[sendEmail()]] - degree 6, connects to 1 community
- [[isEmailConfigured()]] - degree 4, connects to 1 community
- [[sendViaBrevo()]] - degree 4, connects to 1 community
- [[sendViaSmtp()]] - degree 4, connects to 1 community