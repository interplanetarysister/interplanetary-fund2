import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { validateDonationAmount, computeProcessingFee, computeContribution, round2 } from '../../shared/fees.js';
import { ensureCanonicalCampaign } from '../../shared/base44Financial.ts';
import { isPublicCampaignFundraisingEnabled } from '../../shared/fundraisingMode.ts';
import { areFeaturesEnabled, isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isPublicCampaignFundraisingEnabled(base44))) return Response.json({ error: 'Campaign donations are currently paused. The platform remains open for campaigns and sharing.' }, { status: 409 });
    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });
    const donor = donorGuard.donor;

    const { campaign_id, amount, donor_name, message, is_recurring, origin, platform_contribution } = await req.json();
    if (!(await areFeaturesEnabled(base44, ['payment_checkout_enabled','stripe_checkout']))) return featureUnavailable('Card checkout');
    if (is_recurring && !(await isFeatureEnabled(base44, 'recurring_donations'))) return featureUnavailable('New recurring donations');
    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id || !origin) return Response.json({ error: 'Invalid donation request' }, { status: 400 });

    const totalCharge = round2(Number(amount));
    const processing = computeProcessingFee(totalCharge);
    const value = round2(totalCharge - processing);
    const contribution = computeContribution(value, !!platform_contribution);

    let originUrl;
    try { originUrl = new URL(origin); } catch (_) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    const configuredOrigins = String(secrets.get('PUBLIC_APP_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean);
    const allowedOrigins = new Set([
      'https://interplanetaryfund.com',
      'https://www.interplanetaryfund.com',
      'https://interplanetaryfund.base44.app',
      'https://interplanetary-fund2.interplanetary-fund.workers.dev',
      ...configuredOrigins,
    ].map((value) => { try { return new URL(value).origin; } catch (_) { return ''; } }).filter(Boolean));
    if (originUrl.protocol !== 'https:' || !allowedOrigins.has(originUrl.origin)) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim();
    const rateKey = donor?.id ? `createDonationCheckout:user:${donor.id}` : `createDonationCheckout:ip:${ip}`;
    const rl = await checkRateLimit(base44, rateKey, 10, 60);
    if (!rl.allowed) {
      return Response.json({ error: 'Too many checkout attempts. Please slow down and try again.' }, { status: 429 });
    }

    const campaign = await base44.asServiceRole.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'active') return Response.json({ error: 'This campaign is not accepting donations.' }, { status: 400 });

    // Fail closed before creating a provider payment that cannot be reconciled
    // to the canonical financial backend.
    await ensureCanonicalCampaign(base44.asServiceRole, campaign);

    const metadata = {
      base44_app_id: secrets.get('BASE44_APP_ID'),
      campaign_id,
      ...(donor?.id ? { donor_user_id: donor.id } : {}),
      donor_name: donor_name || donor?.full_name || 'Anonymous',
      message: (message || '').slice(0, 450),
      is_recurring: is_recurring ? 'true' : 'false',
      donation_amount: String(value),
      processing_fee: String(processing),
      platform_contribution_amount: String(contribution),
    };

    const stripeSecret = secrets.get('STRIPE_SECRET_KEY');
    if (!stripeSecret || !String(stripeSecret).startsWith('sk_live_')) return Response.json({ error: 'Card payments are not currently available.' }, { status: 503 });
    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.create({
      mode: is_recurring ? 'subscription' : 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(totalCharge * 100),
          product_data: { name: `Donation to ${campaign.title} (includes processor fee)` },
          ...(is_recurring ? { recurring: { interval: 'month' } } : {}),
        },
      }],
      success_url: `${originUrl.origin}/campaign/${campaign_id}?donation=success`,
      cancel_url: `${originUrl.origin}/campaign/${campaign_id}`,
      metadata,
      ...(is_recurring ? { subscription_data: { metadata } } : {}),
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createDonationCheckout error:', error?.message || error);
    return Response.json({ error: 'Could not start checkout safely. Please try again.' }, { status: 503 });
  }
}
