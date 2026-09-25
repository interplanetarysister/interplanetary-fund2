import { FREE_TIER, PLANS, getPlan } from "@/components/subscriptions/plans";

export const TOP_PLAN = PLANS.reduce(
  (top, plan) => (plan.level > top.level ? plan : top),
  FREE_TIER,
);

export function effectiveSubscription(user) {
  if (user?.role === "admin") {
    return {
      plan: TOP_PLAN,
      tier: TOP_PLAN.id,
      status: "active",
      active: true,
      adminGranted: true,
    };
  }

  const plan = getPlan(user?.subscription_tier);
  const active =
    user?.subscription_status === "active" ||
    user?.subscription_status === "trialing";

  return {
    plan,
    tier: plan.id,
    status: user?.subscription_status || "inactive",
    active,
    adminGranted: false,
  };
}

export function hasPlanLevel(user, minimumLevel) {
  const subscription = effectiveSubscription(user);
  return subscription.active && subscription.plan.level >= minimumLevel;
}
