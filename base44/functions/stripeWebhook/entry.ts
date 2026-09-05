import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { logAudit } from '../../shared/auditLog.ts';
import { computeContribution, round2, validateDonationAmount } from '../../shared/fees.js';
import { ensureCanonicalCampaign, recordCanonicalDonation, mirrorCanonicalCampaignTotal } from '../../shared/convexFinancial.ts';
import { reconcileDonationMirror, reconcileNotificationMirror } from '../../shared/financialMirrors.ts';

function webhookOrder(rows) {
  return [...(rows || [])].sort((a, b) => {
    const at = new Date(a.created_date || 0).getTime();
    const bt = new Date(b.created_date || 0).getTime();
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

async function getWebhookRecord(sr, eventKey, eventType) {
  let rows = await sr.entities.WebhookEvent.filter({ source: 'stripe', event_key: eventKey }).catch(() => []);
  let record = webhookOrder(rows)[0] || null;
  if (!record) {
    record = await sr.entities.WebhookEvent.create({
      source: 'stripe',
      event_key: eventKey,
      event_type: eventType,
      state: 'claimed',
      attempt_count: 1,
    });
  } else if (record.state !== 'side_effects_complete' && record.state !== 'nonfinancial_complete') {
    await sr.entities.WebhookEvent.update(record.id, {
      event_type: eventType,
      attempt_count: Number(record.attempt_count || 0) + 1,
      last_error: '',
    });
  }

  // The Base44 row is diagnostic/recovery state, not the financial lock. If
  // simultaneous deliveries created more than one row, converge to one row.
  rows = await sr.entities.WebhookEvent.filter({ source: 'stripe', event_key: eventKey }).catch(() => []);
  const ordered = webhookOrder(rows);
  record = ordered[0] || record;
  for (const duplicate of ordered.slice(1)) {
    await sr.entities.WebhookEvent.delete(duplicate.id).catch(() => {});
  }
  return record;
}

async function markWebhook(sr, record, patch) {
  if (!record?.id) return;
  await sr.entities.WebhookEvent.update(record.id, patch).catch(() => {});
}

function readFinancialMetadata(metadata, campaignId) {
  const m = metadata || {};
  if (!campaignId || m.campaign_id !== campaignId) throw new Error('Stripe metadata campaign mismatch.');
  const total = round2(Number.parseFloat(m.donation_amount));
  const processingFee = round2(Number.parseFloat(m.processing_fee || '0'));
  const contribution = m.platform_contribution_amount != null
    ? round2(Number.parseFloat(m.platform_contribution_amount))
    : computeContribution(total, m.platform_contribution_opt === 'true');

  const amountCheck = validateDonationAmount(total);
  if (!amountCheck.ok) throw new Error(amountCheck.error);
  if (!Number.isFinite(processingFee) || processingFee < 0) throw new Error('Invalid Stripe processing fee metadata.');
  if (!Number.isFinite(contribution) || contribution < 0 || contribution > total) throw new Error('Invalid Stripe contribution metadata.');
  return { total, processingFee, contribution };
}

async function applyStripeDonation({
  base44,
  sr,
  webhookRecord,
  campaignId,
  metadata,
  providerObjectId,
  providerObjectKind,
  providerTransactionId,
  amountCharged,
  currency,
  isRecurring,
  donorEmail,
}) {
  if (String(currency || '').toLowerCase() !== 'usd') throw new Error('Stripe currency mismatch.');
  if (providerObjectKind !== 'session' && providerObjectKind !== 'invoice') throw new Error('Unsupported Stripe financial object.');

  const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
  if (!campaign) throw new Error('Campaign not found for Stripe donation.');
  if (campaign.status !== 'active') throw new Error('Campaign is not accepting donations.');

  const { total, processingFee, contribution } = readFinancialMetadata(metadata, campaignId);
  const expectedCharge = round2(total + processingFee);
  if (Math.abs(round2(Number(amountCharged || 0)) - expectedCharge) > 0.01) {
    throw new Error('Stripe charged amount does not match server-created donation metadata.');
  }

  await ensureCanonicalCampaign(sr, campaign);

  // Financial identity follows the provider object that represents this
  // particular charge. The first payment of a recurring donation is still a
  // Checkout Session; later renewals are invoices. Recurring status is tracked
  // separately so we never mislabel the first recurring payment just to obtain
  // the correct idempotency key.
  const operationKey = `stripe:${providerObjectKind}:${providerObjectId}`;
  const isRenewal = providerObjectKind === 'invoice';
  const donorName = metadata?.donor_name || 'Anonymous';
  const canonical = await recordCanonicalDonation(sr, {
    operationKey,
    provider: 'stripe',
    providerTransactionId: String(providerTransactionId || providerObjectId),
    campaignId,
    campaignTitle: campaign.title,
    campaignOwnerUserId: campaign.created_by_id || '',
    grossAmount: total,
    platformContribution: contribution,
    processingFee,
    donorName,
    ...(donorEmail ? { donorEmail } : {}),
    ...(metadata?.donor_user_id ? { donorUserId: metadata.donor_user_id } : {}),
    message: metadata?.message || '',
    paymentMethod: 'stripe',
    paymentVerified: true,
    source: isRenewal ? 'stripe_invoice_webhook' : 'stripe_checkout_webhook',
    isRecurring: !!isRecurring,
  });

  await markWebhook(sr, webhookRecord, {
    state: 'financial_applied',
    canonical_operation_id: String(canonical.operationId),
    financial_applied_at: new Date().toISOString(),
  });

  await mirrorCanonicalCampaignTotal(sr, campaignId, canonical);
  await reconcileDonationMirror(sr, canonical.operationId, {
    campaign_id: campaignId,
    campaign_title: campaign.title,
    amount: total,
    platform_contribution: contribution,
    processing_fee: processingFee,
    donor_name: donorName,
    message: metadata?.message || '',
    is_recurring: !!isRecurring,
    ...(isRecurring ? { recurring_status: 'active' } : {}),
    ...(metadata?.donor_user_id ? { donor_user_id: metadata.donor_user_id } : {}),
    payment_method: 'stripe',
    payment_verified: true,
    cleared: false,
    stripe_session_id: providerObjectId,
  });

  if (campaign.created_by_id) {
    await reconcileNotificationMirror(sr, canonical.operationId, {
      user_id: campaign.created_by_id,
      title: isRenewal ? 'Recurring donation received' : (isRecurring ? 'New recurring donation received' : 'New donation received'),
      body: isRenewal
        ? `${donorName} renewed $${total.toLocaleString()} to \"${campaign.title}\"`
        : `${donorName} donated $${total.toLocaleString()} to \"${campaign.title}\"`,
      type: 'donation',
      link: `/campaign/${campaign.id}`,
      read: false,
    });
  }

  if (canonical.applied) {
    await logAudit(base44, {
      action: isRenewal ? 'donation_renewal_confirmed' : 'donation_confirmed',
      target_type: 'campaign',
      target_id: campaignId,
      detail: `$${total} confirmed via Stripe through canonical ledger`,
      status: 'success',
      metadata: {
        canonical_operation_id: String(canonical.operationId),
        provider_reference: String(providerTransactionId || providerObjectId),
        provider_object_kind: providerObjectKind,
        recurring: !!isRecurring,
      },
    });
  }

  await markWebhook(sr, webhookRecord, {
    state: 'side_effects_complete',
    canonical_operation_id: String(canonical.operationId),
    side_effects_completed_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
    last_error: '',
  });
  return canonical;
}

export default async function(req) {
  let base44;
  let webhookRecord = null;
  try {
    base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
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

    const eventKey = `stripe:${event.id}`;
    webhookRecord = await getWebhookRecord(sr, eventKey, event.type);
    if (webhookRecord?.state === 'side_effects_complete' || webhookRecord?.state === 'nonfinancial_complete') {
      return Response.json({ received: true, duplicate: true });
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const m = session.metadata || {};

      // AI plan checkout. This is not a campaign donation, so it remains a
      // non-financial application side effect for this particular integrity boundary.
      if (m.subscription_tier) {
        if (m.user_id) {
          await sr.entities.User.update(m.user_id, {
            subscription_tier: m.subscription_tier,
            subscription_status: 'active',
            subscription_interval: m.subscription_interval || 'monthly',
            stripe_customer_id: session.customer || undefined,
          });
        }
        await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete', processed_at: new Date().toISOString(), last_error: '' });
        return Response.json({ received: true });
      }

      if (m.campaign_id) {
        // checkout.session.completed can arrive before an asynchronous payment
        // actually succeeds. Never create financial value until Stripe says paid.
        if (session.payment_status !== 'paid') {
          await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete', processed_at: new Date().toISOString(), last_error: '' });
          return Response.json({ received: true, payment_pending: true });
        }
        await applyStripeDonation({
          base44,
          sr,
          webhookRecord,
          campaignId: m.campaign_id,
          metadata: m,
          providerObjectId: session.id,
          providerObjectKind: 'session',
          providerTransactionId: session.payment_intent || session.id,
          amountCharged: round2((session.amount_total || 0) / 100),
          currency: session.currency,
          isRecurring: m.is_recurring === 'true',
          donorEmail: session.customer_details?.email || undefined,
        });
        return Response.json({ received: true });
      }
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      if (invoice.subscription) {
        let sub;
        try { sub = await stripe.subscriptions.retrieve(invoice.subscription); } catch (_) { sub = null; }
        const sm = sub?.metadata || {};
        if (sm.campaign_id) {
          await applyStripeDonation({
            base44,
            sr,
            webhookRecord,
            campaignId: sm.campaign_id,
            metadata: sm,
            providerObjectId: invoice.id,
            providerObjectKind: 'invoice',
            providerTransactionId: invoice.payment_intent || invoice.id,
            amountCharged: round2((invoice.amount_paid ?? invoice.total ?? invoice.amount_due ?? 0) / 100),
            currency: invoice.currency,
            isRecurring: true,
            donorEmail: invoice.customer_email || undefined,
          });
          return Response.json({ received: true });
        }
      }

      // AI subscription renewal.
      if (invoice.customer) {
        const users = await sr.entities.User.filter({ stripe_customer_id: invoice.customer });
        const u = users && users[0];
        if (u) {
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
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
          const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
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

    await markWebhook(sr, webhookRecord, { state: 'nonfinancial_complete', processed_at: new Date().toISOString(), last_error: '' });
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('stripeWebhook error:', message);
    if (base44 && webhookRecord) {
      await markWebhook(base44.asServiceRole, webhookRecord, {
        state: 'failed',
        last_error: String(message).slice(0, 500),
      });
    }
    // Keep durable recovery state and return 500 so Stripe retries. Financial
    // replay is safe because the canonical Convex mutation owns idempotency.
    return Response.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
