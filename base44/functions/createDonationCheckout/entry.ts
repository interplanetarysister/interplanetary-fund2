import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { validateDonationAmount, computeProcessingFee, round2 } from '../../shared/fees.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { campaign_id, amount, donor_name, message, is_recurring, origin, platform_contribution } = await req.json();
    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id || !origin) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    const value = Number(amount);
    // Processor fee passed through to the donor where Stripe permits: a line
    // item for one-time gifts, folded into the recurring price for monthly. The
    // donation (value) is recorded as Donation.amount; the processing fee is
    // recorded separately and retained by the processor — never by IF.
    const processing = computeProcessingFee(value);
    const totalCharge = round2(value + processing);
    let originUrl;
    try {
      originUrl = new URL(origin);
    } catch (_) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }

    // Narrow abuse guard on session creation only — generous enough that a
    // legitimate donor never hits it, but stops a script spamming sessions.
    const rl = await checkRateLimit(base44, `createDonationCheckout:${user.id}`, 10, 60);
    if (!rl.allowed) {
      return Response.json({ error: 'Too many checkout attempts. Please slow down and try again.' }, { status: 429 });
    }

    const campaign = await base44.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

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
      metadata: {
        base44_app_id: secrets.get('BASE44_APP_ID'),
        campaign_id,
        donor_user_id: user.id,
        donor_name: donor_name || 'Anonymous',
        message: (message || '').slice(0, 450),
        is_recurring: is_recurring ? 'true' : 'false',
        platform_contribution_opt: platform_contribution ? 'true' : 'false',
        // Authoritative donation amount + processing fee for the webhook — the
        // session total is value + processing, so amount must come from here.
        donation_amount: String(value),
        processing_fee: String(processing),
      },
      // For recurring donations, mirror the donation metadata onto the Stripe
      // Subscription so each renewal (invoice.paid) can be attributed back to
      // this campaign and recorded as a new Donation.
      ...(is_recurring ? {
        subscription_data: {
          metadata: {
            campaign_id,
            donor_user_id: user.id,
            donor_name: donor_name || 'Anonymous',
            message: (message || '').slice(0, 450),
            platform_contribution_opt: platform_contribution ? 'true' : 'false',
            is_recurring: 'true',
            donation_amount: String(value),
            processing_fee: String(processing),
          },
        },
      } : {}),
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createDonationCheckout error:', error.message);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}