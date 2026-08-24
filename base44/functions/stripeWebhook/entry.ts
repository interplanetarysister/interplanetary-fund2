import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { getSubscriptionEntitlement } from '../../shared/subscriptionCatalog.ts';

function safeWebhookError() {
  return 'Unable to process Stripe webhook.';
}

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

      if (session.mode === 'subscription') {
        if (m.user_id && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const item = subscription.items?.data?.[0];
          const entitlement = getSubscriptionEntitlement(item?.price?.id);
          if (!entitlement) {
            console.error('Unrecognized subscription price:', item?.price?.id);
            return Response.json({ error: 'Unrecognized subscription price' }, { status: 500 });
          }

          await base44.asServiceRole.entities.User.update(m.user_id, {
            subscription_tier: entitlement.tier,
            subscription_status: subscription.status === 'trialing' ? 'trialing' : 'active',
            subscription_interval: entitlement.interval,
            stripe_customer_id: session.customer || undefined,
          });
        }
        return Response.json({ received: true });
      }

      if (m.campaign_id) {
        const campaign = await base44.asServiceRole.entities.Campaign.get(m.campaign_id);
        if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

        const value = (session.amount_total || 0) / 100;
        const isRecurring = m.is_recurring === 'true';
        const claim = await base44.asServiceRole.entities.Campaign.updateMany(
          {
            id: campaign.id,
            'history.event_id': { $ne: event.id },
          },
          {
            $inc: {
              raised_amount: value,
              donor_count: 1,
            },
            $push: {
              history: {
                event_id: event.id,
                event: 'stripe_donation_claimed',
                at: new Date().toISOString(),
                stripe_session_id: session.id,
                amount: value,
              },
            },
          },
        );

        if (!claim.success || claim.updated !== 1) {
          // The campaign-level conditional update is the durable financial
          // claim boundary. A replay must never increment totals twice.
          // Donation/notification recovery is handled below without another
          // campaign-total mutation.
          const existing = await base44.asServiceRole.entities.Donation.filter({ stripe_session_id: session.id });
          if (existing.length === 0) {
            console.error('Stripe donation claim already exists but Donation record is missing:', event.id);
            return Response.json({ error: 'Donation processing is retryable' }, { status: 500 });
          }
          return Response.json({ received: true, duplicate: true });
        }

        const existing = await base44.asServiceRole.entities.Donation.filter({ stripe_session_id: session.id });
        if (existing.length === 0) {
          await base44.asServiceRole.entities.Donation.create({
            campaign_id: m.campaign_id,
            campaign_title: campaign.title,
            amount: value,
            donor_name: m.donor_name || 'Anonymous',
            message: m.message || '',
            is_recurring: isRecurring,
            ...(isRecurring ? { recurring_status: 'active', stripe_subscription_id: session.subscription || undefined } : {}),
            donor_user_id: m.donor_user_id,
            stripe_session_id: session.id,
          });
        }

        if (campaign.created_by_id) {
          const existingNotifications = await base44.asServiceRole.entities.Notification.filter({
            user_id: campaign.created_by_id,
            type: 'donation',
            link: `/campaign/${campaign.id}`,
          });
          if (existingNotifications.length === 0) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: campaign.created_by_id,
              title: 'New donation received',
              body: `${m.donor_name || 'Anonymous'} donated $${value.toLocaleString()} to \"${campaign.title}\"`,
              type: 'donation',
              link: `/campaign/${campaign.id}`,
            });
          }
        }
      }
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (invoice.customer) {
        const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: invoice.customer });
        const u = users && users[0];
        if (u) {
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
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
          const item = sub.items?.data?.[0];
          const entitlement = getSubscriptionEntitlement(item?.price?.id);
          if (!entitlement) {
            console.error('Unrecognized subscription price on update:', item?.price?.id, 'subscription:', sub.id);
            return Response.json({ error: 'Unrecognized subscription price; retry required' }, { status: 500 });
          }

          await base44.asServiceRole.entities.User.update(u.id, {
            subscription_status: statusMap[sub.status] || 'none',
            ...(sub.current_period_end ? { subscription_renews_at: new Date(sub.current_period_end * 1000).toISOString() } : {}),
            subscription_tier: entitlement.tier,
            subscription_interval: entitlement.interval,
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
    console.error('stripeWebhook error:', error?.message || error);
    return Response.json({ error: safeWebhookError() }, { status: 500 });
  }
}