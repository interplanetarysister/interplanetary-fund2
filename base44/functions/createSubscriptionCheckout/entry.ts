import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const ALLOWED_KEYS = new Set(['tier', 'interval', 'price_id', 'origin', 'trial_days']);
const SAFE_ORIGINS = new Set([
  'https://interplanetary-fund.vercel.app',
  'https://interplanetary-fund.base44.app',
]);
const PLAN_MAP = new Map([
  ['basic:monthly', 'price_1Tz8iSEkntycHB4NlQlYd0Gs'],
  ['basic:annual', 'price_1Tz8iSEkntycHB4N8J7EXq42'],
  ['outreach:monthly', 'price_1Tz8iSEkntycHB4NESNtjyOx'],
  ['outreach:annual', 'price_1Tz8iSEkntycHB4N5iujmlJZ'],
]);

function diagnosticType(error) {
  if (error instanceof Error) return error.name || 'Error';
  if (typeof error === 'string') return 'StringThrow';
  if (error === null) return 'NullThrow';
  return typeof error === 'object' ? 'ObjectThrow' : 'PrimitiveThrow';
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasUnsafeControls(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function boundedText(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || hasUnsafeControls(trimmed)) return null;
  return trimmed;
}

function isSafeCheckoutUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    return url.hostname === 'checkout.stripe.com' || url.hostname.endsWith('.stripe.com');
  } catch (_) {
    return false;
  }
}

async function readBody(req) {
  try {
    const body = await req.json();
    if (!isRecord(body)) return null;
    if (Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) return null;
    return body;
  } catch (_) {
    return null;
  }
}

export default async function(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' },
    });
  }

  try {
    const body = await readBody(req);
    if (!body) return Response.json({ error: 'Invalid subscription details' }, { status: 400 });

    const tier = boundedText(body.tier, 32);
    const interval = boundedText(body.interval, 16);
    const priceId = boundedText(body.price_id, 128);
    if (!tier || !interval || !priceId || !/^(monthly|annual)$/.test(interval)) {
      return Response.json({ error: 'Invalid subscription details' }, { status: 400 });
    }
    if (PLAN_MAP.get(`${tier}:${interval}`) !== priceId) {
      return Response.json({ error: 'Invalid subscription plan.' }, { status: 400 });
    }

    if (typeof body.origin !== 'string' || body.origin.length > 2048 || hasUnsafeControls(body.origin)) {
      return Response.json({ error: 'Invalid subscription details' }, { status: 400 });
    }
    let originUrl;
    try { originUrl = new URL(body.origin); } catch (_) {
      return Response.json({ error: 'Invalid subscription details' }, { status: 400 });
    }
    if (originUrl.protocol !== 'https:' || originUrl.pathname !== '/' || originUrl.search || originUrl.hash || !SAFE_ORIGINS.has(originUrl.origin)) {
      return Response.json({ error: 'Invalid subscription details' }, { status: 400 });
    }

    let trialDays;
    if (body.trial_days !== undefined) {
      if (!Number.isInteger(body.trial_days) || body.trial_days < 1 || body.trial_days > 365) {
        return Response.json({ error: 'Invalid subscription details' }, { status: 400 });
      }
      trialDays = body.trial_days;
    }

    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const safeUserId = String(user.id).slice(0, 128);
    const metadata = {
      base44_app_id: String(secrets.get('BASE44_APP_ID') || '').slice(0, 128),
      user_id: safeUserId,
      subscription_tier: tier,
      subscription_interval: interval,
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${originUrl.origin}/subscriptions?subscribed=success`,
      cancel_url: `${originUrl.origin}/subscriptions`,
      metadata,
      ...(trialDays ? { subscription_data: { trial_period_days: trialDays, metadata } } : {}),
    });

    if (!session || !isSafeCheckoutUrl(session.url)) {
      console.error('createSubscriptionCheckout provider response invalid: ProviderResponse');
      return Response.json({ error: 'Could not start your subscription. Please try again.' }, { status: 503 });
    }
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createSubscriptionCheckout error:', diagnosticType(error));
    return Response.json({ error: 'Could not start your subscription. Please try again.' }, { status: 503 });
  }
}
