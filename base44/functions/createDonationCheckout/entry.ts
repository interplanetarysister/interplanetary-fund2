import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* public donors may be signed out */ }

    const { campaign_id, amount, donor_name, message, is_recurring, origin } = await req.json();
    const value = Number(amount);
    if (!campaign_id || !value || value <= 0 || !origin) {
      return Response.json({ error: 'Invalid donation request' }, { status: 400 });
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
      success_url: `${origin}/campaign/${campaign_id}?donation=success`,
      cancel_url: `${origin}/campaign/${campaign_id}`,
      metadata: {
        base44_app_id: secrets.get('BASE44_APP_ID'),
        campaign_id,
        donor_user_id: user?.id,
        donor_name: donor_name || 'Anonymous',
        message: (message || '').slice(0, 450),
        is_recurring: is_recurring ? 'true' : 'false',
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createDonationCheckout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}