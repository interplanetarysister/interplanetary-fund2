import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secrets.get('STRIPE_WEBHOOK_SECRET'));
    } catch (err) {
      console.error('Invalid webhook signature:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const m = session.metadata || {};
      if (m.campaign_id) {
        // Idempotency: skip if this session was already recorded
        const existing = await base44.asServiceRole.entities.Donation.filter({ stripe_session_id: session.id });
        if (existing.length === 0) {
          const value = (session.amount_total || 0) / 100;
          const isRecurring = m.is_recurring === 'true';
          const campaign = await base44.asServiceRole.entities.Campaign.get(m.campaign_id);

          await base44.asServiceRole.entities.Donation.create({
            campaign_id: m.campaign_id,
            campaign_title: campaign ? campaign.title : undefined,
            amount: value,
            donor_name: m.donor_name || 'Anonymous',
            message: m.message || '',
            is_recurring: isRecurring,
            ...(isRecurring ? { recurring_status: 'active' } : {}),
            donor_user_id: m.donor_user_id,
            stripe_session_id: session.id,
          });

          if (campaign) {
            await base44.asServiceRole.entities.Campaign.update(campaign.id, {
              raised_amount: (campaign.raised_amount || 0) + value,
              donor_count: (campaign.donor_count || 0) + 1,
            });
            if (campaign.created_by_id) {
              await base44.asServiceRole.entities.Notification.create({
                user_id: campaign.created_by_id,
                title: 'New donation received',
                body: `${m.donor_name || 'Anonymous'} donated $${value.toLocaleString()} to "${campaign.title}"`,
                type: 'donation',
                link: `/campaign/${campaign.id}`,
              });
            }
          }
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}