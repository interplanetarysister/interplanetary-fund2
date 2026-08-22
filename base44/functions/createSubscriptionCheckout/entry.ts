import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { getSubscriptionPrice, SUPPORTED_SUBSCRIPTION_INTERVALS } from '../../shared/subscriptionCatalog.ts';

const DEFAULT_CHECKOUT_ORIGIN = 'https://interplanetary-fund.vercel.app';
const MAX_TRIAL_DAYS = 30;

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

function validateTrialDays(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > MAX_TRIAL_DAYS) return null;
  return numeric;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier, interval = 'monthly', origin, trial_days } = await req.json();
    const price_id = getSubscriptionPrice(tier, interval);
    const checkoutOrigin = validateCheckoutOrigin(origin);
    const trialDays = validateTrialDays(trial_days);
    const trialProvided = trial_days !== undefined && trial_days !== null && trial_days !== '';

    if (
      !tier ||
      !checkoutOrigin ||
      !price_id ||
      !SUPPORTED_SUBSCRIPTION_INTERVALS.includes(interval) ||
      (trialProvided && trialDays === null)
    ) {
      return Response.json({ error: 'Invalid subscription plan, trial period, or checkout destination.' }, { status: 400 });
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
      ...(trialDays !== null
        ? { subscription_data: { trial_period_days: trialDays, metadata: { user_id: user.id } } }
        : {}),
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createSubscriptionCheckout error:', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Unable to create subscription checkout.' }, { status: 500 });
  }
}