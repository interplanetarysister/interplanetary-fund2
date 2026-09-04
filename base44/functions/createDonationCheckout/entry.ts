import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { validateDonationAmount, computeProcessingFee, computeContribution, round2 } from '../../shared/fees.js';
import { ensureCanonicalCampaign } from '../../shared/convexFinancial.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { campaign_id, amount, donor_name, message, is_recurring, origin, platform_contribution } = await req.json();
    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id || !origin) return Response.json({ error: 'Invalid donation request' }, { status: 400 });

    const value = Number(amount);
    const processing = computeProcessingFee(value);
    const contribution = computeContribution(value, !!platform_contribution);
    const totalCharge = round2(value + processing);

    let originUrl;
    try { originUrl = new URL(origin); } catch (_) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }

    const rl = await checkRateLimit(base44, `createDonationCheckout:${user.id}`, 10, 60);
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
      donor_user_id: user.id,
      donor_name: donor_name || 'Anonymous',
      message: (message || '').slice(0, 450),
      is_recurring: is_recurring ? 'true' : 'false',
      donation_amount: String(value),
      processing_fee: String(processing),
      platform_contribution_amount: String(contribution),
    };

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const session = await stripe.checkout.sessions.create({
      mode: is_recurring ? 'subscription' : 'payment',
      line_items: is_recurring ? [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(totalCharge * 100),
          product_data: { name: `Donation to ${campaign.title}` },
          recurring: { interval: 'month' },
        },
      }] : [
        { quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(value * 100), product_data: { name: `Donation to ${campaign.title}` } } },
        { quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(processing * 100), product_data: { name: 'Processing fee (Stripe)' } } },
      ],
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
