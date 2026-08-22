import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { getSubscriptionPrice, SUPPORTED_SUBSCRIPTION_INTERVALS } from '../../shared/subscriptionCatalog.ts';

const DEFAULT_CHECKOUT_ORIGIN = 'https://interplanetary-fund.vercel.app';

function getAllowedCheckoutOrigins() {
  const configured = Deno.env.get('ALLOWED_CHECKOUT_ORIGINS') || DEFAULT_CHECKOUT_ORIGIN;
  return new Set(configured.split(',').map((origin) => origin.trim()).filter(Boolean));
}

function validateCheckoutOrigin(origin) {
  if (typeof origin !== 'string' || !origin.trim()) return null;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return null;
  const normalized = parsed.origin;
  return getAllowedCheckoutOrigins().has(normalized) ? normalized : null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier, interval = 'monthly', origin, trial_days } = await req.json();
    const price_id = getSubscriptionPrice(tier, interval);
    const checkoutOrigin = validateCheckoutOrigin(origin);
    if (!tier || !checkoutOrigin || !price_id || !SUPPORTED_SUBSCRIPTION_INTERVALS.includes(interval)) {
      return Response.json({ error: 'Invalid subscription plan or checkout destination.' }, { status: 400 });
    }

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${checkoutOrigin}/subscriptions?subscribed=success`,
      cancel_url: `${checkoutOrigin}/subscriptions`,
      metadata: {
        base44_app_id: secrets.get('BASE44_APP_ID'),
        user_id: user.id,
      },
      ...(trial_days
        ? { subscription_data: { trial_period_days: Math.max(0, Math.min(Number(trial_days), 30)), metadata: { user_id: user.id } } }
        : {}),
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createSubscriptionCheckout error:', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Unable to create subscription checkout.' }, { status: 500 });
  }
}