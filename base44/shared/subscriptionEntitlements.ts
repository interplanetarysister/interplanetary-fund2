export const SUBSCRIPTION_LEVEL: Record<string, number> = {
  free: 0,
  basic: 1,
  outreach: 2,
  nonprofit: 2,
  professional: 3,
  enterprise: 4,
};

export const MANAGED_CONNECTIONS_MIN_LEVEL = 2;

export const TOP_SUBSCRIPTION_TIER = 'enterprise';
export const TOP_SUBSCRIPTION_LEVEL = SUBSCRIPTION_LEVEL[TOP_SUBSCRIPTION_TIER];

export function effectiveSubscription(user: any) {
  if (user?.role === 'admin') {
    return {
      tier: TOP_SUBSCRIPTION_TIER,
      level: TOP_SUBSCRIPTION_LEVEL,
      status: 'active',
      active: true,
      adminGranted: true,
    };
  }
  const status = String(user?.subscription_status || 'inactive');
  return {
    tier: String(user?.subscription_tier || 'free'),
    level: SUBSCRIPTION_LEVEL[String(user?.subscription_tier || 'free')] || 0,
    status,
    active: status === 'active' || status === 'trialing',
    adminGranted: false,
  };
}

export function hasManagedConnections(user: any) {
  return hasSubscriptionLevel(user, MANAGED_CONNECTIONS_MIN_LEVEL);
}

export function hasSubscriptionLevel(user: any, minimumLevel: number) {
  const subscription = effectiveSubscription(user);
  return subscription.active && subscription.level >= minimumLevel;
}
