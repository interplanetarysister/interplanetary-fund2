import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { SUBSCRIPTION_CATALOG, getSubscriptionEntitlement } from '../../shared/subscriptionCatalog.ts';

export default async function(req: Request) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const checks = [];

    for (const [tier, intervals] of Object.entries(SUBSCRIPTION_CATALOG)) {
      for (const [interval, priceId] of Object.entries(intervals)) {
        const entitlement = getSubscriptionEntitlement(priceId);
        const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
        const actualInterval = price.recurring?.interval || null;
        const product = typeof price.product === 'string' ? null : price.product;
        const productActive = product ? product.active : true;
        const valid = Boolean(
          price.active &&
          price.type === 'recurring' &&
          price.currency === 'usd' &&
          actualInterval === interval &&
          entitlement?.tier === tier &&
          entitlement?.interval === interval &&
          productActive,
        );

        checks.push({
          tier,
          interval,
          price_id: priceId,
          active: price.active,
          currency: price.currency,
          actual_interval: actualInterval,
          type: price.type,
          product_active: productActive,
          valid,
        });
      }
    }

    const invalid = checks.filter((check) => !check.valid);
    return Response.json({
      ok: invalid.length === 0,
      checked: checks.length,
      invalid: invalid.length,
      checks,
    }, { status: invalid.length === 0 ? 200 : 409 });
  } catch (error) {
    console.error('verifyStripeCatalog error:', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Unable to verify the Stripe subscription catalog.' }, { status: 500 });
  }
}
