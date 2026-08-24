import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function safeWebhookError() {
  return 'Unable to process Ko-fi webhook.';
}

function supportedDonationType(type) {
  if (!type) return true;
  return new Set(['Donation', 'donation', 'Payment', 'payment', 'Monthly Donation', 'monthly_donation']).has(type);
}

const RECOVERY_CLAIM_STALE_MS = 5 * 60 * 1000;

async function ensureSideEffects(sr, connection, payload, amount, eventId) {
  const existingInbox = await sr.entities.InboxItem.filter({ external_event_id: eventId });
  if (existingInbox.length === 0) {
    await sr.entities.InboxItem.create({
      user_id: connection.created_by_id,
      platform: 'kofi',
      campaign_id: connection.campaign_id,
      type: 'donation',
      author: payload.from_name || 'Ko-fi supporter',
      content: `Gave $${amount}${payload.message ? ` — \"${payload.message}\"` : ''}`,
      link: payload.url || connection.external_url || '',
      status: 'open',
      external_event_id: eventId,
    });
  }

  const existingNotification = await sr.entities.Notification.filter({ external_event_id: eventId });
  if (existingNotification.length === 0) {
    await sr.entities.Notification.create({
      user_id: connection.created_by_id,
      title: 'New Ko-fi donation',
      body: `${payload.from_name || 'A supporter'} gave $${amount} on Ko-fi`,
      type: 'donation',
      link: '/inbox',
      external_event_id: eventId,
    });
  }
}

async function reconcileEventLedger(sr, eventId, connection, payload, amount, claimedAt) {
  const existing = await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId });
  if (existing.length > 0) return existing[0];

  // The connection-level claim is the single-winner boundary. Only the
  // request that owns the active event claim may create the durable ledger.
  // Base44 does not expose a documented unique/upsert entity primitive.
  return sr.entities.KoFiWebhookEvent.create({
    event_id: eventId,
    provider: 'kofi',
    message_id: payload.message_id,
    connection_id: connection.id,
    user_id: connection.created_by_id,
    amount,
    event_type: payload.type || 'donation',
    claimed_at: claimedAt,
    side_effects_complete: false,
    last_error: '',
  });
}

async function completeEventLedger(sr, ledger) {
  if (!ledger?.id) return;
  await sr.entities.KoFiWebhookEvent.update(ledger.id, {
    side_effects_complete: true,
    last_error: '',
  });
}

async function recoverClaimedEvent(sr, eventId, connection, payload, amount, claimedAt) {
  // A retry can arrive after the financial claim committed but before the
  // durable ledger was written. The active-event marker remains on the same
  // connection until recovery is complete, so concurrent retries can elect
  // only one recovery owner with updateMany's conditional compare-and-set.
  let ledger = (await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId }))[0];
  if (ledger) {
    await ensureSideEffects(sr, connection, payload, amount, eventId);
    await completeEventLedger(sr, ledger);
    return ledger;
  }

  const recoveryToken = `${eventId}:${crypto.randomUUID()}`;
  const staleBefore = new Date(Date.now() - RECOVERY_CLAIM_STALE_MS).toISOString();
  const recoveryClaim = await sr.entities.PlatformConnection.updateMany(
    {
      id: connection.id,
      kofi_active_event_id: eventId,
      $or: [
        { kofi_recovery_claimed_at: { $exists: false } },
        { kofi_recovery_claimed_at: { $lt: staleBefore } },
      ],
    },
    {
      $set: {
        kofi_recovery_claim_token: recoveryToken,
        kofi_recovery_claimed_at: new Date().toISOString(),
      },
    },
  );

  if (!recoveryClaim.success || recoveryClaim.updated !== 1) {
    ledger = (await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId }))[0];
    if (ledger) {
      await ensureSideEffects(sr, connection, payload, amount, eventId);
      await completeEventLedger(sr, ledger);
      return ledger;
    }
    throw new Error('Ko-fi event recovery is already owned by another worker. Retry later.');
  }

  ledger = await reconcileEventLedger(sr, eventId, connection, payload, amount, claimedAt);
  await ensureSideEffects(sr, connection, payload, amount, eventId);
  await completeEventLedger(sr, ledger);
  return ledger;
}

// Live Ko-fi donation sync. Ko-fi POSTs form-encoded webhooks with a `data`
// JSON field containing a verification_token. The token authenticates the
// request: it must match the token the connection owner saved when connecting
// Ko-fi. The financial mutation is guarded by an atomic updateMany claim on
// the connection. A durable provider-event ledger records the claimed event
// so downstream side effects can be repaired after the short-lived claim gate
// is no longer present.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let payload;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await req.json();
      if (typeof payload.data === 'string') payload = JSON.parse(payload.data);
      else if (payload.data) payload = payload.data;
    } else {
      const form = await req.formData();
      const raw = form.get('data');
      if (!raw) return Response.json({ error: 'Missing data field' }, { status: 400 });
      payload = JSON.parse(raw);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return Response.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    const token = payload.verification_token;
    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'Missing verification token' }, { status: 401 });
    }

    const messageId = payload.message_id;
    if (!messageId || typeof messageId !== 'string' || messageId.length > 200) {
      return Response.json({ error: 'Missing webhook message id' }, { status: 400 });
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return Response.json({ error: 'Invalid webhook amount' }, { status: 400 });
    }

    if (!supportedDonationType(payload.type)) {
      return Response.json({ ok: true, ignored: true });
    }

    const connections = await sr.entities.PlatformConnection.filter({ platform: 'kofi' });
    const connection = connections.find((c) => c.credentials?.kofi_verification_token === token);
    if (!connection) return Response.json({ error: 'Unknown verification token' }, { status: 401 });

    const eventId = `kofi:${messageId}`;
    const existingLedger = await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId });

    if (existingLedger.length > 0) {
      const ledger = existingLedger[0];
      try {
        await ensureSideEffects(sr, connection, payload, amount, eventId);
        await completeEventLedger(sr, ledger);
        return Response.json({ ok: true, duplicate: true, repaired: true });
      } catch (error) {
        console.error('kofiWebhook side-effect recovery error:', error);
        if (ledger.id) {
          await sr.entities.KoFiWebhookEvent.update(ledger.id, {
            side_effects_complete: false,
            last_error: 'Downstream side-effect recovery failed.',
          });
        }
        return Response.json({ error: safeWebhookError() }, { status: 500 });
      }
    }

    const claimedAt = new Date().toISOString();
    const claim = await sr.entities.PlatformConnection.updateMany(
      {
        id: connection.id,
        processed_webhook_ids: { $ne: messageId },
        kofi_active_event_id: { $exists: false },
      },
      {
        $inc: {
          external_total: amount,
          external_donor_count: 1,
        },
        $addToSet: {
          processed_webhook_ids: messageId,
        },
        $set: {
          status: 'connected',
          last_synced: claimedAt,
          last_error: '',
          kofi_active_event_id: eventId,
        },
        $push: {
          history: {
            at: claimedAt,
            event: 'synced',
            detail: `Ko-fi ${payload.type || 'donation'}: $${amount} from ${payload.from_name || 'a supporter'}`,
          },
        },
      },
    );

    if (!claim.success || claim.updated !== 1) {
      try {
        await recoverClaimedEvent(sr, eventId, connection, payload, amount, claimedAt);
        return Response.json({ ok: true, duplicate: true, repaired: true });
      } catch (error) {
        console.error('kofiWebhook duplicate recovery error:', error);
        const ledger = (await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId }))[0];
        if (ledger?.id) {
          await sr.entities.KoFiWebhookEvent.update(ledger.id, {
            side_effects_complete: false,
            last_error: 'Downstream side-effect recovery failed.',
          });
        }
        return Response.json({ error: safeWebhookError() }, { status: 500 });
      }
    }

    try {
      const ledger = await reconcileEventLedger(sr, eventId, connection, payload, amount, claimedAt);
      await ensureSideEffects(sr, connection, payload, amount, eventId);
      await completeEventLedger(sr, ledger);
    } catch (error) {
      console.error('kofiWebhook claimed-event recovery error:', error);
      const ledger = (await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId }))[0];
      if (ledger?.id) {
        await sr.entities.KoFiWebhookEvent.update(ledger.id, {
          side_effects_complete: false,
          last_error: 'Downstream side-effect recovery failed.',
        });
      }
      return Response.json({ error: safeWebhookError() }, { status: 500 });
    }

    await sr.entities.PlatformConnection.updateMany(
      {
        id: connection.id,
        kofi_active_event_id: eventId,
      },
      {
        $pull: { processed_webhook_ids: messageId },
        $unset: {
          kofi_active_event_id: '',
          kofi_recovery_claim_token: '',
          kofi_recovery_claimed_at: '',
        },
      },
    );

    return Response.json({ ok: true, claimed: true });
  } catch (error) {
    console.error('kofiWebhook error:', error);
    return Response.json({ error: safeWebhookError() }, { status: 500 });
  }
}
