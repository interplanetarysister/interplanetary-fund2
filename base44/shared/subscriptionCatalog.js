// Authoritative IFund subscription pricing, mirrored to PayPal products/plans.
// All amounts are USD cents. Increment CATALOG_VERSION when pricing changes;
// never silently mutate an existing paid PayPal plan.
export const CATALOG_VERSION = '2026-10-v1';
export const SUBSCRIPTION_PRICING = Object.freeze({
  basic:        { name: 'Basic AI Assistant', monthly: 1200,  annual: 11500 },
  outreach:     { name: 'AI Outreach Agent', monthly: 4900,  annual: 47000 },
  professional: { name: 'Professional Outreach', monthly: 9900,  annual: 95000 },
  enterprise:   { name: 'Enterprise', monthly: 19900, annual: 191000 },
  nonprofit:    { name: 'Nonprofit', monthly: 2900,  annual: 28000 },
});
// These existing Stripe IDs are available as an alternative payment method.
// Do not infer a plan's price from an untrusted client-submitted price ID.
export const SUBSCRIPTION_STRIPE_PRICES = Object.freeze({
  basic: { monthly: 'price_1Tz8iSEkntycHB4NlQlYd0Gs', annual: 'price_1Tz8iSEkntycHB4N8J7EXq42' },
  outreach: { monthly: 'price_1Tz8iSEkntycHB4NESNtjyOx', annual: 'price_1Tz8iSEkntycHB4N5iujmlJZ' },
});
export function stripePriceFor(tier, interval) {
  return SUBSCRIPTION_STRIPE_PRICES[tier]?.[interval] || null;
}
export function subscriptionPrice(tier, interval) {
  const price = SUBSCRIPTION_PRICING[String(tier || '')];
  if (!price || !['monthly', 'annual'].includes(interval)) return null;
  return { tier, interval, name: price.name, amount_cents: price[interval], currency: 'USD', version: CATALOG_VERSION };
}
export function subscriptionPrices() {
  return Object.keys(SUBSCRIPTION_PRICING).flatMap(tier =>
    ['monthly', 'annual'].map(interval => subscriptionPrice(tier, interval)));
}
export function providerPriceIsExact(providerPlan, expected) {
  const cycle = providerPlan?.billing_cycles?.find(row => row.tenure_type === 'REGULAR');
  const unit = expected?.interval === 'annual' ? 'YEAR' : 'MONTH';
  return Boolean(expected && providerPlan?.status === 'ACTIVE' &&
    cycle?.frequency?.interval_unit === unit &&
    Number(cycle?.frequency?.interval_count || 1) === 1 &&
    Number(cycle?.total_cycles) === 0 &&
    cycle?.pricing_scheme?.fixed_price?.currency_code === 'USD' &&
    Math.round(Number(cycle?.pricing_scheme?.fixed_price?.value) * 100) === expected.amount_cents);
}
