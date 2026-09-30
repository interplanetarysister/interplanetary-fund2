import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { validateDonationAmount, computeProcessingFee, computeContribution, round2 } from '../../shared/fees.js';
import { ensureCanonicalCampaign } from '../../shared/convexFinancial.ts';

const ALLOWED_KEYS = new Set([
  'campaign_id',
  'amount',
  'donor_name',
  'message',
  'is_recurring',
  'origin',
  'platform_contribution',
]);
const MAX_ID = 128;
const MAX_TEXT = 240;
const MAX_MESSAGE = 450;
const SAFE_ORIGINS = new Set([
  'https://interplanetary-fund.vercel.app',
  'https://interplanetary-fund.base44.app',
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
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || hasUnsafeControls(trimmed)) return null;
  return trimmed;
}

function boundedId(value) {
  const normalized = boundedText(value, MAX_ID);
  if (!normalized || !/^[A-Za-z0-9_-]+$/.test(normalized)) return null;
  return normalized;
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
  let body;
  try {
    body = await req.json();
  } catch (_) {
    return { ok: false };
  }
  if (!isRecord(body)) return { ok: false };
  const keys = Object.keys(body);
  if (keys.some((key) => !ALLOWED_KEYS.has(key))) return { ok: false };
  return { ok: true, body };
}

export default async function(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' },
    });
  }

  try {
    const parsed = await readBody(req);
    if (!parsed.ok) return Response.json({ error: 'Invalid donation request' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });
    const donor = donorGuard.donor;
    const { body } = parsed;

    const campaignId = boundedId(body.campaign_id);
    const donorName = body.donor_name === undefined ? '' : boundedText(body.donor_name, MAX_TEXT);
    const message = body.message === undefined ? '' : boundedText(body.message, MAX_MESSAGE);
    if (!campaignId || donorName === null || message === null) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    if (typeof body.is_recurring !== 'undefined' && typeof body.is_recurring !== 'boolean') {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    if (typeof body.platform_contribution !== 'undefined' && typeof body.platform_contribution !== 'boolean') {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    if (typeof body.origin !== 'string' || hasUnsafeControls(body.origin) || body.origin.length > 2048) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }

    let originUrl;
    try { originUrl = new URL(body.origin); } catch (_) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    if (originUrl.protocol !== 'https:' || originUrl.pathname !== '/' || originUrl.search || originUrl.hash || !SAFE_ORIGINS.has(originUrl.origin)) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }

    const amountCheck = validateDonationAmount(body.amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    const value = Number(body.amount);
    const processing = computeProcessingFee(value);
    const contribution = computeContribution(value, body.platform_contribution === true);
    const totalCharge = round2(value + processing);

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim().slice(0, 128);
    const rateKey = donor?.id ? `createDonationCheckout:user:${String(donor.id).slice(0, MAX_ID)}` : `createDonationCheckout:ip:${ip}`;
    const rl = await checkRateLimit(base44, rateKey, 10, 60);
    if (!rl.allowed) return Response.json({ error: 'Too many checkout attempts. Please slow down and try again.' }, { status: 429 });

    let campaign;
    try {
      campaign = await base44.asServiceRole.entities.Campaign.get(campaignId);
    } catch (error) {
      console.error('createDonationCheckout campaign lookup failed:', diagnosticType(error));
      return Response.json({ error: 'Could not validate the campaign safely. Please try again.' }, { status: 503 });
    }
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'active') return Response.json({ error: 'This campaign is not accepting donations.' }, { status: 400 });

    await ensureCanonicalCampaign(base44.asServiceRole, campaign);

    const safeCampaignTitle = boundedText(campaign.title, MAX_TEXT) || 'Campaign';
    const safeDonorName = donorName || boundedText(donor?.full_name, MAX_TEXT) || 'Anonymous';
    const safeMessage = message || '';
    const metadata = {
      base44_app_id: String(secrets.get('BASE44_APP_ID') || '').slice(0, MAX_ID),
      campaign_id: campaignId,
      ...(donor?.id ? { donor_user_id: String(donor.id).slice(0, MAX_ID) } : {}),
      donor_name: safeDonorName,
      message: safeMessage,
      is_recurring: body.is_recurring === true ? 'true' : 'false',
      donation_amount: String(value),
      processing_fee: String(processing),
      platform_contribution_amount: String(contribution),
    };

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const isRecurring = body.is_recurring === true;
    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? 'subscription' : 'payment',
      line_items: isRecurring ? [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(totalCharge * 100),
          product_data: { name: `Donation to ${safeCampaignTitle}` },
          recurring: { interval: 'month' },
        },
      }] : [
        { quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(value * 100), product_data: { name: `Donation to ${safeCampaignTitle}` } } },
        { quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(processing * 100), product_data: { name: 'Processing fee (Stripe)' } } },
      ],
      success_url: `${originUrl.origin}/campaign/${encodeURIComponent(campaignId)}?donation=success`,
      cancel_url: `${originUrl.origin}/campaign/${encodeURIComponent(campaignId)}`,
      metadata,
      ...(isRecurring ? { subscription_data: { metadata } } : {}),
    });
    if (!session || !isSafeCheckoutUrl(session.url)) {
      console.error('createDonationCheckout provider response invalid: ProviderResponse');
      return Response.json({ error: 'Could not start checkout safely. Please try again.' }, { status: 503 });
    }
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createDonationCheckout error:', diagnosticType(error));
    return Response.json({ error: 'Could not start checkout safely. Please try again.' }, { status: 503 });
  }
}
