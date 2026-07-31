// Subscription plan catalog for Crowdfund AI tiers.
// Designed so new tiers can be appended here without touching checkout or UI
// code. Each tier declares monthly + annual Stripe price IDs (filled in after
// the prices are created) and the feature set used by the subscribe UI.
//
// Tiers are ordered by elevation; `level` controls gating (higher = more).
// `outreach` unlocks the autonomous AI Outreach Agent.

export const PLANS = [
  {
    id: "basic",
    name: "Basic AI Assistant",
    level: 1,
    tagline: "AI story writing and campaign coaching.",
    features: [
      "AI Story Generator & Optimizer",
      "Campaign AI profile (AI Instructions)",
      "On-demand AI coaching tips",
      "Single campaign at a time",
    ],
    monthly: { amount: 1200, stripe_price_id: "" },
    annual: { amount: 11500, stripe_price_id: "" },
  },
  {
    id: "outreach",
    name: "AI Outreach Agent",
    level: 2,
    tagline: "An autonomous fundraising assistant that works while you're away.",
    featured: true,
    features: [
      "Everything in Basic AI Assistant",
      "Autonomous campaign monitoring",
      "AI-generated outreach messages & social posts",
      "Audience & opportunity recommendations",
      "Recommended posting times & scheduling drafts",
      "Continuous messaging optimization",
      "Full activity log with approve / reject / pause",
      "Works across all your campaigns",
    ],
    monthly: { amount: 4900, stripe_price_id: "" },
    annual: { amount: 47000, stripe_price_id: "" },
  },
  {
    id: "professional",
    name: "Professional Outreach",
    level: 3,
    tagline: "For organizers running multiple active campaigns.",
    features: [
      "Everything in AI Outreach Agent",
      "Multi-campaign AI coordination",
      "Priority AI processing",
      "Advanced performance forecasting",
    ],
    monthly: { amount: 9900, stripe_price_id: "" },
    annual: { amount: 95000, stripe_price_id: "" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    level: 4,
    tagline: "For large organizations and agencies.",
    features: [
      "Everything in Professional Outreach",
      "Custom AI guardrails & compliance review",
      "Team seats & roles",
      "Dedicated support",
    ],
    monthly: { amount: 19900, stripe_price_id: "" },
    annual: { amount: 191000, stripe_price_id: "" },
  },
  {
    id: "nonprofit",
    name: "Nonprofit",
    level: 2,
    tagline: "Discounted full-power Outreach Agent for registered nonprofits.",
    features: [
      "Everything in AI Outreach Agent",
      "Nonprofit pricing",
    ],
    monthly: { amount: 2900, stripe_price_id: "" },
    annual: { amount: 28000, stripe_price_id: "" },
  },
];

export const FREE_TIER = { id: "free", name: "Free", level: 0 };

export function getPlan(id) {
  return PLANS.find((p) => p.id === id) || FREE_TIER;
}

export function planAllowsOutreach(tierId) {
  return getPlan(tierId).level >= 2;
}

// Stripe price metadata, used by createSubscriptionCheckout to resolve the
// correct price object id at checkout time.
export function priceFor(tierId, interval) {
  const plan = getPlan(tierId);
  if (plan === FREE_TIER) return null;
  return plan[interval]?.stripe_price_id || null;
}