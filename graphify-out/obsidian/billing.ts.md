---
source_file: "backend/api/src/routes/billing.ts"
type: "code"
community: "stripe-webhook.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/stripe-webhookts
---

# billing.ts

## Connections
- [[apisrcindex.ts]] - `imports_from` [EXTRACTED]
- [[authMiddleware()]] - `indirect_call` [INFERRED]
- [[billing-stripe.ts]] - `imports_from` [EXTRACTED]
- [[billingRouter]] - `contains` [EXTRACTED]
- [[createBillingPortalSession()]] - `imports` [EXTRACTED]
- [[createCheckoutSession()]] - `imports` [EXTRACTED]
- [[fetchStripeSubscription()]] - `imports` [EXTRACTED]
- [[isActiveStripeSubscription()]] - `imports` [EXTRACTED]
- [[loadOrgAndPlan()]] - `contains` [EXTRACTED]
- [[middlewareauth.ts]] - `imports_from` [EXTRACTED]
- [[orgScope()]] - `imports` [EXTRACTED]
- [[planIdSchema]] - `contains` [EXTRACTED]
- [[requireAdmin()]] - `indirect_call` [INFERRED]
- [[resolveActiveSubscription()]] - `contains` [EXTRACTED]
- [[resolvePlanChangeAction()]] - `imports` [EXTRACTED]
- [[resolveStripePriceId()]] - `imports` [EXTRACTED]
- [[stripeNotConfiguredResponse()]] - `imports` [EXTRACTED]
- [[updateStripeSubscriptionPlan()]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/stripe-webhookts