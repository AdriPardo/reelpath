---
source_file: "backend/api/src/lib/stripe-webhook.ts"
type: "code"
community: "stripe-webhook.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/stripe-webhookts
---

# stripe-webhook.ts

## Connections
- [[BillingStatus]] - `imports` [EXTRACTED]
- [[PaidPlanId]] - `imports` [EXTRACTED]
- [[PlanLimits]] - `imports` [EXTRACTED]
- [[StripeEvent]] - `contains` [EXTRACTED]
- [[apisrclibplan-limits.ts]] - `imports_from` [EXTRACTED]
- [[applyPaidPlan()]] - `contains` [EXTRACTED]
- [[billing-stripe.ts]] - `imports_from` [EXTRACTED]
- [[billing-webhook.ts]] - `imports_from` [EXTRACTED]
- [[claimWebhookEvent()]] - `imports` [EXTRACTED]
- [[coerceLimits()_1]] - `contains` [EXTRACTED]
- [[dispatchStripeEvent()]] - `contains` [EXTRACTED]
- [[downgradeOrg()]] - `contains` [EXTRACTED]
- [[findOrgByStripeIds()]] - `contains` [EXTRACTED]
- [[handleCheckoutCompleted()]] - `contains` [EXTRACTED]
- [[handleInvoicePaymentFailed()]] - `contains` [EXTRACTED]
- [[handleStripeWebhook()]] - `contains` [EXTRACTED]
- [[handleSubscriptionDeleted()]] - `contains` [EXTRACTED]
- [[handleSubscriptionUpdated()]] - `contains` [EXTRACTED]
- [[isPaidPlanId()]] - `imports` [EXTRACTED]
- [[mapStripeSubscriptionStatus()]] - `imports` [EXTRACTED]
- [[parseStripeEvent()]] - `contains` [EXTRACTED]
- [[readMetadata()]] - `contains` [EXTRACTED]
- [[readPeriodEnd()]] - `contains` [EXTRACTED]
- [[resolvePlanIdFromPrice()]] - `imports` [EXTRACTED]
- [[stripe-webhook.test.ts]] - `imports_from` [EXTRACTED]
- [[verifyStripeSignature()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/stripe-webhookts