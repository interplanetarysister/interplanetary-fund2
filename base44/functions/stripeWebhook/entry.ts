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

      // Subscription activation — AI tier checkout.
      if (session.mode === 'subscription' || m.subscription_tier) {
        if (m.user_id) {
          await base44.asServiceRole.entities.User.update(m.user_id, {
            subscription_tier: m.subscription_tier,
            subscription_status: 'active',
            subscription_interval: m.subscription_interval || 'monthly',
            stripe_customer_id: session.customer || undefined,
          });
        }
        return Response.json({ received: true });
      }

      // Donation checkout.
      if (m.campaign_id) {
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

    // ---- AI subscription lifecycle: renewal paid, status change, cancellation ----
    else if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (invoice.customer) {
        const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: invoice.customer });
        const u = users && users[0];
        if (u) {
          const periodEnd = invoice.lines && invoice.lines.data && invoice.lines.data[0] && invoice.lines.data[0].period && invoice.lines.data[0].period.end;
          await base44.asServiceRole.entities.User.update(u.id, {
            subscription_status: 'active',
            ...(periodEnd ? { subscription_renews_at: new Date(periodEnd * 1000).toISOString() } : {}),
          });
        }
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      if (sub.customer) {
        const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: sub.customer });
        const u = users && users[0];
        if (u) {
          const statusMap = { trialing: 'trialing', active: 'active', past_due: 'past_due', canceled: 'canceled', incomplete_expired: 'canceled', unpaid: 'canceled' };
          const interval = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.recurring && sub.items.data[0].price.recurring.interval;
          await base44.asServiceRole.entities.User.update(u.id, {
            subscription_status: statusMap[sub.status] || 'none',
            ...(sub.current_period_end ? { subscription_renews_at: new Date(sub.current_period_end * 1000).toISOString() } : {}),
            ...(interval === 'month' ? { subscription_interval: 'monthly' } : interval === 'year' ? { subscription_interval: 'annual' } : {}),
          });
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      if (sub.customer) {
        const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: sub.customer });
        const u = users && users[0];
        if (u) {
          await base44.asServiceRole.entities.User.update(u.id, {
            subscription_status: 'canceled',
            subscription_tier: 'free',
            subscription_renews_at: null,
          });
          await base44.asServiceRole.entities.Notification.create({
            user_id: u.id,
            title: 'Subscription canceled',
            body: 'Your AI subscription has been canceled. You are now on the Free tier.',
            type: 'system',
            link: '/subscriptions',
          });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}