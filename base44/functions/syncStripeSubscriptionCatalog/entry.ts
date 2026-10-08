import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { CATALOG_VERSION, subscriptionPrices, stripePriceFor } from '../../shared/subscriptionCatalog.js';
import { stripeSubscriptionClient, verifiedStripePrice } from '../../shared/stripeSubscriptionCatalog.ts';

// Creates/reuses no-cost Stripe Product and Price catalog entries ONLY.
// It never creates a customer, subscription, checkout, payment or charge.
const APP_ID = '6a67a778342a8fe05ee79cba';
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Administrator only.' }, { status: 403 });
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    const { stripe, accountId } = await stripeSubscriptionClient();
    const sr = base44.asServiceRole;
    const version = CATALOG_VERSION.replace(/[^a-zA-Z0-9]/g,'');
    const rows = await sr.entities.SubscriptionPlanMapping.filter({ provider: 'stripe', account_ref: accountId });
    const products = await stripe.products.list({ limit: 100, active: true });
    if (products.has_more) throw new Error('Merchant catalog exceeds safe discovery page size.');
    const result: any[] = [];
    const cachedProducts: Record<string,string> = {};
    for (const expected of subscriptionPrices()) {
      const saved = (rows || []).find((row: any) => row.tier === expected.tier && row.interval === expected.interval &&
        row.catalog_version === CATALOG_VERSION);
      const original = stripePriceFor(expected.tier, expected.interval);
      if (saved?.plan_id || original) {
        const id = String(saved?.plan_id || original);
        // A legacy, hard-coded ID may belong to a different merchant account.
        // Never trust an absent historical price, but do not let that stale ID
        // prevent an admin from provisioning the correct IFund live catalog.
        const price = await stripe.prices.retrieve(id).catch((error: any) => {
          if (saved?.plan_id || error?.statusCode !== 404) throw error;
          return null;
        });
        if (price && !verifiedStripePrice(price, expected)) throw new Error('An existing Stripe price conflicts with published IFund pricing.');
        if (price) {
        const product = typeof price.product === 'string' ? price.product : price.product?.id;
        if (!product) throw new Error('Existing Stripe price has no product.');
        cachedProducts[expected.tier] = product;
        const mapping = {
          provider: 'stripe', account_ref: accountId, tier: expected.tier, interval: expected.interval,
          currency: 'USD', amount_cents: expected.amount_cents, catalog_version: CATALOG_VERSION,
          product_id: product, plan_id: id, verified_at: new Date().toISOString(),
        };
        if (saved?.id) await sr.entities.SubscriptionPlanMapping.update(saved.id, mapping);
        else await sr.entities.SubscriptionPlanMapping.create(mapping);
        result.push({ tier: expected.tier, interval: expected.interval, amount_cents: expected.amount_cents, status: 'reused_verified' });
        continue;
        }
      }
      let productId = cachedProducts[expected.tier];
      if (!productId) {
        let product = (products.data || []).find((item: any) =>
          item.metadata?.ifund_app_id === APP_ID &&
          item.metadata?.ifund_tier === expected.tier &&
          item.metadata?.ifund_catalog_version === CATALOG_VERSION);
        if (!product) {
          product = await stripe.products.create({
            name: 'Interplanetary Fund — ' + expected.name,
            description: 'Recurring IFund AI subscription: ' + expected.name,
            metadata: { ifund_app_id: APP_ID, ifund_tier: expected.tier, ifund_catalog_version: CATALOG_VERSION },
          }, { idempotencyKey: 'ifund_subscription_product_' + version + '_' + expected.tier });
        }
        productId = product.id;
        cachedProducts[expected.tier] = productId;
      }
      const priceList = await stripe.prices.list({ product: productId, limit: 100 });
      if (priceList.has_more) throw new Error('The provider product has too many prices to safely deduplicate.');
      let price = (priceList.data || []).find((item: any) =>
        item.metadata?.ifund_interval === expected.interval &&
        item.metadata?.ifund_catalog_version === CATALOG_VERSION);
      if (!price) {
        price = await stripe.prices.create({
          product: productId,
          currency: 'usd', unit_amount: expected.amount_cents,
          recurring: { interval: expected.interval === 'annual' ? 'year' : 'month' },
          metadata: { ifund_app_id: APP_ID, ifund_tier: expected.tier,
            ifund_interval: expected.interval, ifund_catalog_version: CATALOG_VERSION },
        }, { idempotencyKey: 'ifund_subscription_price_' + version + '_' + expected.tier + '_' + expected.interval });
      }
      if (!verifiedStripePrice(price, expected)) throw new Error('Stripe returned a price not matching IFund.');
      const mapping = {
        provider: 'stripe', account_ref: accountId,
        tier: expected.tier, interval: expected.interval,
        currency: 'USD', amount_cents: expected.amount_cents, catalog_version: CATALOG_VERSION,
        product_id: productId, plan_id: price.id, verified_at: new Date().toISOString(),
      };
      if (saved?.id) await sr.entities.SubscriptionPlanMapping.update(saved.id, mapping);
      else await sr.entities.SubscriptionPlanMapping.create(mapping);
      result.push({ tier: expected.tier, interval: expected.interval, amount_cents: expected.amount_cents, status: 'created_verified' });
    }
    return Response.json({ ok: result.length === 10, catalog_version: CATALOG_VERSION,
      prices: result, charges_created: false, checkout_enabled: false });
  } catch (error) {
    console.error('syncStripeSubscriptionCatalog:', error?.name || 'UnknownError');
    return Response.json({ error: 'The Stripe subscription catalog could not be fully verified. Existing prices remain intact; no charges were created.' }, { status: 503 });
  }
}
