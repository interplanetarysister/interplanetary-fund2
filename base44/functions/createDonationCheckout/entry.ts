import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { checkRateLimit } from '../../shared/rateLimit.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { campaign_id, amount, donor_name, message, is_recurring, origin, platform_contribution } = await req.json();
    const value = Number(amount);
    if (!campaign_id || !value || value <= 0 || !origin) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
    }
    if (value > 1000000) {
      return Response.json({ error: 'Donation amount is too large.' }, { status: 400 });
    }
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
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(value * 100),
          product_data: { name: `Donation to ${campaign.title}` },
          ...(is_recurring ? { recurring: { interval: 'month' } } : {}),
        },
      }],
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
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createDonationCheckout error:', error.message);
    return Response.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}