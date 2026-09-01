import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { logAudit } from '../../shared/auditLog.ts';
import { computeContribution, round2 } from '../../shared/fees.js';

export default async function(req) {
  let base44;
  try {
    base44 = createClientFromRequest(req);
    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secrets.get('STRIPE_WEBHOOK_SECRET'));
    } catch (err) {
      console.error('Invalid webhook signature:', err instanceof Error ? err.message : 'unknown');
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Durable idempotency on Stripe's signed event id. A retry of the same
    // event finds the claim and is skipped; a processing failure releases the
    // claim so Stripe's retry can reprocess. The signed event id is unique per
    // event, so each event type is processed exactly once.
    const sr = base44.asServiceRole;
    const eventKey = `stripe:${event.id}`;
    const prior = await sr.entities.WebhookEvent.filter({ source: 'stripe', event_key: eventKey }, '-created_date', 1).catch(() => []);
    if (prior && prior.length) {
      return Response.json({ received: true, duplicate: true });
    }
    const claim = await sr.entities.WebhookEvent.create({
      source: 'stripe',
      event_key: eventKey,
      processed_at: new Date().toISOString(),
    });

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const m = session.metadata || {};

        // Subscription activation — AI tier checkout.
        if (session.mode === 'subscription' || m.subscription_tier) {
          if (m.user_id) {
            await sr.entities.User.update(m.user_id, {
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
          // Secondary guard: a session is confirmed once, but keep the
          // session-id check as defense-in-depth alongside the event.id claim.
          const existing = await sr.entities.Donation.filter({ stripe_session_id: session.id });
          if (existing.length === 0) {
            const total = round2((session.amount_total || 0) / 100);
            const optedIn = m.platform_contribution_opt === 'true';
            const contribution = computeContribution(total, optedIn);
            const gift = round2(total - contribution);
            const isRecurring = m.is_recurring === 'true';
            const campaign = await sr.entities.Campaign.get(m.campaign_id);

            await sr.entities.Donation.create({
              campaign_id: m.campaign_id,
              campaign_title: campaign ? campaign.title : undefined,
              amount: total,
              platform_contribution: contribution,
              donor_name: m.donor_name || 'Anonymous',
              message: m.message || '',
              is_recurring: isRecurring,
              ...(isRecurring ? { recurring_status: 'active' } : {}),
              donor_user_id: m.donor_user_id,
              payment_method: 'stripe',
              stripe_session_id: session.id,
            });

            if (campaign) {
              // Atomic increment — avoids the read-modify-write race on
              // concurrent gifts. raised_amount reflects the recipient's gift;
              // the contribution is retained by the platform.
              await sr.entities.Campaign.updateMany(
                { id: campaign.id },
                { $inc: { raised_amount: gift, donor_count: 1 } }
              );
              if (campaign.created_by_id) {
                await sr.entities.Notification.create({
                  user_id: campaign.created_by_id,
                  title: 'New donation received',
                  body: `${m.donor_name || 'Anonymous'} donated $${total.toLocaleString()} to "${campaign.title}"`,
                  type: 'donation',
                  link: `/campaign/${campaign.id}`,
                });
              }
            }
            await logAudit(base44, { action: 'donation_confirmed', target_type: 'campaign', target_id: m.campaign_id, detail: `$${total} confirmed via stripe (gift $${gift})`, status: 'success' });
          }
        }
      }

      // ---- AI subscription lifecycle: renewal paid, status change, cancellation ----
      else if (event.type === 'invoice.paid') {
        const invoice = event.data.object;
        if (invoice.customer) {
          const users = await sr.entities.User.filter({ stripe_customer_id: invoice.customer });
          const u = users && users[0];
          if (u) {
            const periodEnd = invoice.lines && invoice.lines.data && invoice.lines.data[0] && invoice.lines.data[0].period && invoice.lines.data[0].period.end;
            await sr.entities.User.update(u.id, {
              subscription_status: 'active',
              ...(periodEnd ? { subscription_renews_at: new Date(periodEnd * 1000).toISOString() } : {}),
            });
          }
        }
      } else if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object;
        if (sub.customer) {
          const users = await sr.entities.User.filter({ stripe_customer_id: sub.customer });
          const u = users && users[0];
          if (u) {
            const statusMap = { trialing: 'trialing', active: 'active', past_due: 'past_due', canceled: 'canceled', incomplete_expired: 'canceled', unpaid: 'canceled' };
            const interval = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.recurring && sub.items.data[0].price.recurring.interval;
            await sr.entities.User.update(u.id, {
              subscription_status: statusMap[sub.status] || 'none',
              ...(sub.current_period_end ? { subscription_renews_at: new Date(sub.current_period_end * 1000).toISOString() } : {}),
              ...(interval === 'month' ? { subscription_interval: 'monthly' } : interval === 'year' ? { subscription_interval: 'annual' } : {}),
            });
          }
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        if (sub.customer) {
          const users = await sr.entities.User.filter({ stripe_customer_id: sub.customer });
          const u = users && users[0];
          if (u) {
            await sr.entities.User.update(u.id, {
              subscription_status: 'canceled',
              subscription_tier: 'free',
              subscription_renews_at: null,
            });
            await sr.entities.Notification.create({
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
    } catch (procErr) {
      // Processing failed — release the claim so Stripe's retry can reprocess.
      console.error('stripeWebhook processing error:', procErr instanceof Error ? procErr.message : 'unknown');
      await sr.entities.WebhookEvent.delete(claim.id).catch(() => {});
      throw procErr;
    }
  } catch (error) {
    console.error('stripeWebhook error:', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}