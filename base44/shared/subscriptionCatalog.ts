// Single server-owned source of truth for subscription price IDs and entitlements.
// Keep this file server-side; never accept a client-supplied Stripe price ID.

export const SUBSCRIPTION_CATALOG = Object.freeze({
  basic: Object.freeze({
    monthly: 'price_1Tz8iSEkntycHB4NlQlYd0Gs',
    annual: 'price_1Tz8iSEkntycHB4N8J7EXq42',
  }),
  outreach: Object.freeze({
    monthly: 'price_1Tz8iSEkntycHB4NESNtjyOx',
    annual: 'price_1Tz8iSEkntycHB4N5iujmlJZ',
  }),
});

export const SUPPORTED_SUBSCRIPTION_INTERVALS = Object.freeze(['monthly', 'annual']);

export const PRICE_ENTITLEMENTS = Object.freeze(
  Object.entries(SUBSCRIPTION_CATALOG).reduce((result, [tier, intervals]) => {
    for (const [interval, priceId] of Object.entries(intervals)) {
      if (result[priceId]) throw new Error(`Duplicate Stripe price in subscription catalog: ${priceId}`);
      result[priceId] = { tier, interval };
    }
    return result;
  }, {}),
);

export function getSubscriptionPrice(tier, interval = 'monthly') {
  if (!SUPPORTED_SUBSCRIPTION_INTERVALS.includes(interval)) return null;
  return SUBSCRIPTION_CATALOG[tier]?.[interval] || null;
}

export function getSubscriptionEntitlement(priceId) {
  return PRICE_ENTITLEMENTS[priceId] || null;
}

export function verifySubscriptionCatalog() {
  const prices = Object.values(SUBSCRIPTION_CATALOG).flatMap((intervals) => Object.values(intervals));
  if (prices.length !== Object.keys(PRICE_ENTITLEMENTS).length) {
    throw new Error('Subscription catalog contains duplicate Stripe prices');
  }
  for (const [tier, intervals] of Object.entries(SUBSCRIPTION_CATALOG)) {
    for (const interval of SUPPORTED_SUBSCRIPTION_INTERVALS) {
      const priceId = intervals[interval];
      if (!priceId || PRICE_ENTITLEMENTS[priceId]?.tier !== tier || PRICE_ENTITLEMENTS[priceId]?.interval !== interval) {
        throw new Error(`Incomplete subscription entitlement mapping for ${tier}/${interval}`);
      }
    }
  }
  return true;
}

verifySubscriptionCatalog();
