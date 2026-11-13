import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { stripeCryptoGatewayReadiness } from '../../shared/stripeCryptoReadiness.ts';
import { computeCryptoBreakdown, round2, validateDonationAmount } from '../../shared/fees.js';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { campaignPaymentAccess } from '../../shared/prelaunchPayments.ts';
import { areFeaturesEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';

// Creates a Stripe-hosted cryptocurrency checkout for ONE active campaign.
//
// Money is never credited from this call or from a browser return. The signed
// stripeWebhook event verifies a live, paid charge whose payment method really
// is crypto before any FinancialOperation exists. Crypto checkout stays closed
// until the provider itself reports the crypto method approved and the live
// webhook registered, so a toggle or a UI visit can never accept funds early.
const APP_ORIGIN = 'https://interplanetaryfund.base44.app';
const cents = (value: number) => Math.round(round2(value) * 100);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const access = await campaignPaymentAccess(base44);
    if (!access.allowed) {
      return Response.json({ error: 'Campaign donations are currently paused. The platform remains open for campaigns and sharing.' }, { status: 409 });
    }
    if (!(await areFeaturesEnabled(base44, ['payment_checkout_enabled', 'crypto_donations']))) {
      return featureUnavailable('Cryptocurrency donations');
    }

    const readiness = await stripeCryptoGatewayReadiness();
    if (!readiness.ready) {
      console.warn('createCryptoDonationCheckout blocked:', readiness.reason);
      return Response.json({ error: 'Crypto donations are not available yet. No payment was started.' }, { status: 409 });
    }

    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id || '').trim();
    if (!campaignId) return Response.json({ error: 'A campaign is required' }, { status: 400 });

    const amountCheck = validateDonationAmount(body?.amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });

    const intentId = String(body?.intent_id || '');
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(intentId)) {
      return Response.json({ error: 'A stable payment intent is required' }, { status: 400 });
    }

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim();
    const rl = await checkRateLimit(base44, `createCryptoDonationCheckout:${ip}`, 10, 60);
    if (!rl.allowed) return Response.json({ error: 'Too many attempts. Please slow down and try again.' }, { status: 429 });

    const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'active') return Response.json({ error: 'This campaign is not accepting donations.' }, { status: 400 });
    if (campaign.accept_crypto_donations !== true) {
      return Response.json({ error: 'This campaign does not accept cryptocurrency donations.' }, { status: 400 });
    }

    const optedIn = body?.platform_contribution === true;
    const quote = computeCryptoBreakdown(Number(body.amount), optedIn);
    if (!(quote.recipientGift > 0)) return Response.json({ error: 'The campaign gift must remain positive.' }, { status: 400 });
    if (!(quote.totalCharged > 0) || quote.totalCharged > 1000000) {
      return Response.json({ error: 'The total payment amount is too large.' }, { status: 400 });
    }

    const stripe = new Stripe(String(secrets.get('STRIPE_SECRET_KEY')));
    const donorName = String(donorGuard.donor?.full_name || '').slice(0, 120);
    const message = String(body?.message || '').slice(0, 400);

    const lineItems: any[] = [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: cents(quote.amount),
        product_data: { name: `Donation to ${String(campaign.title || 'this campaign').slice(0, 100)}` },
      },
    }];
    if (quote.processing > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: cents(quote.processing),
          product_data: { name: 'Crypto payment processing' },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['crypto'],
      line_items: lineItems,
      client_reference_id: campaignId,
      success_url: `${APP_ORIGIN}/campaign/${encodeURIComponent(campaignId)}?crypto=processing`,
      cancel_url: `${APP_ORIGIN}/campaign/${encodeURIComponent(campaignId)}?crypto=cancelled`,
      // Every value the webhook re-verifies. Nothing here is trusted on its own;
      // stripeWebhook re-checks the campaign, the charged amount and the rail.
      metadata: {
        campaign_id: campaignId,
        donation_amount: String(round2(quote.amount)),
        processing_fee: String(round2(quote.processing)),
        platform_contribution_amount: String(round2(quote.contribution)),
        platform_contribution_opt: optedIn ? 'true' : 'false',
        payment_rail: 'stripe_crypto',
        donor_name: donorName,
        ...(message ? { message } : {}),
        ...(donorGuard.donor?.id ? { donor_user_id: donorGuard.donor.id } : {}),
      },
    }, { idempotencyKey: `crypto-checkout:${intentId}` });

    if (!session?.url) {
      return Response.json({ error: 'Crypto checkout could not be created. Nothing was charged.' }, { status: 502 });
    }
    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('createCryptoDonationCheckout failed:', error?.message || error);
    return Response.json({ error: 'Unable to start your crypto donation. Please try again.' }, { status: 503 });
  }
}