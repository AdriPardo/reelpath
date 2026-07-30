---
type: community
cohesion: 0.09
members: 48
---

# stripe-webhook.ts

**Cohesion:** 0.09 - loosely connected
**Members:** 48 nodes

## Members
- [[ACTIVE_SUBSCRIPTION_STATUSES]] - code - backend/api/src/lib/billing-stripe.ts
- [[BillingStatus]] - code - backend/api/src/lib/billing-stripe.ts
- [[PAID_PLAN_IDS]] - code - backend/api/src/lib/billing-stripe.ts
- [[PaidPlanId]] - code - backend/api/src/lib/billing-stripe.ts
- [[PlanChangeAction]] - code - backend/api/src/lib/billing-stripe.ts
- [[StripeEvent]] - code - backend/api/src/lib/stripe-webhook.ts
- [[StripeSubscription]] - code - backend/api/src/lib/billing-stripe.ts
- [[WebhookEventStore]] - code - backend/api/src/lib/billing-stripe.ts
- [[appendCheckoutTaxParams()]] - code - backend/api/src/lib/billing-stripe.ts
- [[applyPaidPlan()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[billing-stripe.test.ts]] - code - backend/api/src/lib/billing-stripe.test.ts
- [[billing-stripe.ts]] - code - backend/api/src/lib/billing-stripe.ts
- [[billing-webhook.ts]] - code - backend/api/src/routes/billing-webhook.ts
- [[billing.ts]] - code - backend/api/src/routes/billing.ts
- [[billingRouter]] - code - backend/api/src/routes/billing.ts
- [[billingWebhookHandler()]] - code - backend/api/src/routes/billing-webhook.ts
- [[claimWebhookEvent()]] - code - backend/api/src/lib/billing-stripe.ts
- [[coerceLimits()_1]] - code - backend/api/src/lib/stripe-webhook.ts
- [[createBillingPortalSession()]] - code - backend/api/src/lib/billing-stripe.ts
- [[createCheckoutSession()]] - code - backend/api/src/lib/billing-stripe.ts
- [[dispatchStripeEvent()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[downgradeOrg()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[fetchStripeSubscription()]] - code - backend/api/src/lib/billing-stripe.ts
- [[findOrgByStripeIds()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[handleCheckoutCompleted()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[handleInvoicePaymentFailed()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[handleStripeWebhook()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[handleSubscriptionDeleted()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[handleSubscriptionUpdated()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[isActiveStripeSubscription()]] - code - backend/api/src/lib/billing-stripe.ts
- [[isPaidPlanId()]] - code - backend/api/src/lib/billing-stripe.ts
- [[loadOrgAndPlan()]] - code - backend/api/src/routes/billing.ts
- [[mapStripeSubscriptionStatus()]] - code - backend/api/src/lib/billing-stripe.ts
- [[parseStripeEvent()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[planIdSchema]] - code - backend/api/src/routes/billing.ts
- [[readMetadata()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[readPeriodEnd()]] - code - backend/api/src/lib/stripe-webhook.ts
- [[resolveActiveSubscription()]] - code - backend/api/src/routes/billing.ts
- [[resolvePlanChangeAction()]] - code - backend/api/src/lib/billing-stripe.ts
- [[resolvePlanIdFromPrice()]] - code - backend/api/src/lib/billing-stripe.ts
- [[resolveStripePriceId()]] - code - backend/api/src/lib/billing-stripe.ts
- [[signPayload()]] - code - backend/api/src/lib/stripe-webhook.test.ts
- [[stripe-webhook.test.ts]] - code - backend/api/src/lib/stripe-webhook.test.ts
- [[stripe-webhook.ts]] - code - backend/api/src/lib/stripe-webhook.ts
- [[stripeNotConfiguredResponse()]] - code - backend/api/src/lib/billing-stripe.ts
- [[stripeRequest()]] - code - backend/api/src/lib/billing-stripe.ts
- [[updateStripeSubscriptionPlan()]] - code - backend/api/src/lib/billing-stripe.ts
- [[verifyStripeSignature()]] - code - backend/api/src/lib/stripe-webhook.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/stripe-webhookts
SORT file.name ASC
```

## Connections to other communities
- 5 edges to [[_COMMUNITY_apisrcindex.ts]]
- 3 edges to [[_COMMUNITY_middlewareauth.ts]]
- 2 edges to [[_COMMUNITY_routesauth.ts]]
- 2 edges to [[_COMMUNITY_apisrclibplan-limits.ts]]

## Top bridge nodes
- [[billing.ts]] - degree 18, connects to 2 communities
- [[stripe-webhook.ts]] - degree 26, connects to 1 community
- [[handleSubscriptionUpdated()]] - degree 11, connects to 1 community
- [[handleInvoicePaymentFailed()]] - degree 4, connects to 1 community
- [[billing-webhook.ts]] - degree 4, connects to 1 community