---
source_file: "backend/api/src/lib/billing-stripe.ts"
type: "code"
community: "stripe-webhook.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/stripe-webhookts
---

# billing-stripe.ts

## Connections
- [[ACTIVE_SUBSCRIPTION_STATUSES]] - `contains` [EXTRACTED]
- [[BillingStatus]] - `contains` [EXTRACTED]
- [[PAID_PLAN_IDS]] - `contains` [EXTRACTED]
- [[PaidPlanId]] - `contains` [EXTRACTED]
- [[PlanChangeAction]] - `contains` [EXTRACTED]
- [[StripeSubscription]] - `contains` [EXTRACTED]
- [[WebhookEventStore]] - `contains` [EXTRACTED]
- [[appendCheckoutTaxParams()]] - `contains` [EXTRACTED]
- [[billing-stripe.test.ts]] - `imports_from` [EXTRACTED]
- [[billing.ts]] - `imports_from` [EXTRACTED]
- [[claimWebhookEvent()]] - `contains` [EXTRACTED]
- [[createBillingPortalSession()]] - `contains` [EXTRACTED]
- [[createCheckoutSession()]] - `contains` [EXTRACTED]
- [[fetchStripeSubscription()]] - `contains` [EXTRACTED]
- [[isActiveStripeSubscription()]] - `contains` [EXTRACTED]
- [[isPaidPlanId()]] - `contains` [EXTRACTED]
- [[mapStripeSubscriptionStatus()]] - `contains` [EXTRACTED]
- [[resolvePlanChangeAction()]] - `contains` [EXTRACTED]
- [[resolvePlanIdFromPrice()]] - `contains` [EXTRACTED]
- [[resolveStripePriceId()]] - `contains` [EXTRACTED]
- [[stripe-webhook.ts]] - `imports_from` [EXTRACTED]
- [[stripeNotConfiguredResponse()]] - `contains` [EXTRACTED]
- [[stripeRequest()]] - `contains` [EXTRACTED]
- [[updateStripeSubscriptionPlan()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/stripe-webhookts