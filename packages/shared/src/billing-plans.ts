export const PAID_PLAN_IDS = ['starter', 'pro', 'unlimited'] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export function isPaidPlan(planId: string | undefined | null): planId is PaidPlanId {
  return !!planId && (PAID_PLAN_IDS as readonly string[]).includes(planId);
}
