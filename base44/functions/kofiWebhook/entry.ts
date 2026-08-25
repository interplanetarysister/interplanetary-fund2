import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function safeWebhookError() {
  return 'Unable to process Ko-fi webhook.';
}

function supportedDonationType(type) {
  if (!type) return true;
  return new Set(['Donation', 'donation', 'Payment', 'payment', 'Monthly Donation', 'monthly_donation']).has(type);
}

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

async function ensureEventLedgerUnderClaim(sr, eventId, connection, payload, amount, claimedAt) {
  const existing = await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId });
  if (existing.length > 0) return existing[0];

  return sr.entities.KoFiWebhookEvent.create({
    event_id: eventId,
    provider: 'kofi',
    message_id: payload.message_id,
    connection_id: connection.id,
    user_id: connection.created_by_id,
    amount,
    event_type: payload.type || 'donation',
    claimed_at: claimedAt,
    financial_applied: false,
    side_effects_complete: false,
    last_error: '',
  });
}

async function applyFinancialClaim(sr, connectionId, eventId, claimToken, amount) {
  const result = await sr.entities.PlatformConnection.updateMany(
    {
      id: connectionId,
      kofi_active_event_id: eventId,
      kofi_active_event_claim_token: claimToken,
      $or: [
        { kofi_active_event_financial_applied: { $exists: false } },
        { kofi_active_event_financial_applied: false },
      ],
    },
    {
      $inc: {
        external_total: amount,
        external_donor_count: 1,
      },
      $set: {
        kofi_active_event_financial_applied: true,
      },
    },
  );

  if (result.success && result.updated === 1) return true;

  const current = await sr.entities.PlatformConnection.get(connectionId);
  if (
    current?.kofi_active_event_id === eventId &&
    current?.kofi_active_event_claim_token === claimToken &&
    current?.kofi_active_event_financial_applied === true
  ) {
    return false;
  }

  throw new Error('Ko-fi financial claim ownership was lost before completion.');
}

async function completeEventLedger(sr, ledger) {
  if (!ledger?.id) return;
  await sr.entities.KoFiWebhookEvent.update(ledger.id, {
    financial_applied: true,
    side_effects_complete: true,
    last_error: '',
  });
}

async function clearActiveClaim(sr, connectionId, eventId, claimToken) {
  await sr.entities.PlatformConnection.updateMany(
    {
      id: connectionId,
      kofi_active_event_id: eventId,
      kofi_active_event_claim_token: claimToken,
    },
    {
      $unset: {
        kofi_active_event_id: '',
        kofi_active_event_claimed_at: '',
        kofi_active_event_claim_token: '',
        kofi_active_event_financial_applied: '',
        kofi_recovery_required: '',
      },
    },
  );
}

async function markRecoveryRequired(sr, connectionId, eventId, claimToken) {
  await sr.entities.PlatformConnection.updateMany(
    {
      id: connectionId,
      kofi_active_event_id: eventId,
      kofi_active_event_claim_token: claimToken,
    },
    {
      $set: {
        kofi_recovery_required: true,
      },
    },
  );
}

async function acquireRecoveryClaim(sr, connection, eventId) {
  const recoveryToken = `${eventId}:${crypto.randomUUID()}`;
  const recoveryClaim = await sr.entities.PlatformConnection.updateMany(
    {
      id: connection.id,
      kofi_active_event_id: eventId,
      kofi_recovery_required: true,
    },
    {
      $set: {
        kofi_active_event_claim_token: recoveryToken,
        kofi_recovery_required: false,
      },
    },
  );

  return recoveryClaim.success && recoveryClaim.updated === 1 ? recoveryToken : null;
}

async function processClaimedEvent(sr, connection, payload, amount, eventId, claimedAt, claimToken) {
  let ledger = (await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId }))[0];
  if (!ledger) {
    ledger = await ensureEventLedgerUnderClaim(sr, eventId, connection, payload, amount, claimedAt);
  }

  await applyFinancialClaim(sr, connection.id, eventId, claimToken, amount);
  await ensureSideEffects(sr, connection, payload, amount, eventId);
  await completeEventLedger(sr, ledger);
  await clearActiveClaim(sr, connection.id, eventId, claimToken);
  return ledger;
}

async function recoverClaimedEvent(sr, eventId, connection, payload, amount, claimedAt) {
  let ledger = (await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId }))[0];
  if (ledger?.side_effects_complete) return ledger;

  const recoveryToken = await acquireRecoveryClaim(sr, connection, eventId);
  if (!recoveryToken) {
    throw new Error('Ko-fi event recovery is not explicitly available yet. Retry later.');
  }

  return processClaimedEvent(
    sr,
    connection,
    payload,
    amount,
    eventId,
    ledger?.claimed_at || claimedAt,
    recoveryToken,
  );
}

// Live Ko-fi donation sync. The connection-level active-event claim is the
// authoritative single-winner boundary for the entire event lifecycle. It is
// held from claim acquisition through durable ledger creation, financial
// application, downstream side effects, and completion. Recovery takeover is
// only enabled after the previous worker explicitly marks the event as needing
// recovery; a time-based lease alone is never treated as proof that a worker
// stopped.
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
    let ledger = (await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId }))[0];

    if (ledger?.side_effects_complete) {
      return Response.json({ ok: true, duplicate: true });
    }

    if (ledger) {
      try {
        await recoverClaimedEvent(sr, eventId, connection, payload, amount, ledger.claimed_at);
        return Response.json({ ok: true, duplicate: true, repaired: true });
      } catch (error) {
        console.error('kofiWebhook ledger recovery error:', error);
        if (ledger.id) {
          await sr.entities.KoFiWebhookEvent.update(ledger.id, {
            side_effects_complete: false,
            last_error: 'Downstream side-effect recovery is awaiting an explicit recovery claim.',
          });
        }
        return Response.json({ ok: true, duplicate: true, retry: true }, { status: 202 });
      }
    }

    const claimedAt = new Date().toISOString();
    const claimToken = `${eventId}:${crypto.randomUUID()}`;
    const claim = await sr.entities.PlatformConnection.updateMany(
      {
        id: connection.id,
        kofi_active_event_id: { $exists: false },
      },
      {
        $set: {
          status: 'connected',
          last_synced: claimedAt,
          last_error: '',
          kofi_active_event_id: eventId,
          kofi_active_event_claimed_at: claimedAt,
          kofi_active_event_claim_token: claimToken,
          kofi_active_event_financial_applied: false,
          kofi_recovery_required: false,
        },
        $push: {
          history: {
            at: claimedAt,
            event: 'claimed',
            detail: `Ko-fi ${payload.type || 'donation'}: $${amount} from ${payload.from_name || 'a supporter'}`,
          },
        },
      },
    );

    if (!claim.success || claim.updated !== 1) {
      return Response.json({ ok: true, duplicate: true, retry: true }, { status: 202 });
    }

    try {
      await processClaimedEvent(sr, connection, payload, amount, eventId, claimedAt, claimToken);
    } catch (error) {
      console.error('kofiWebhook claimed-event recovery error:', error);
      const failedLedger = (await sr.entities.KoFiWebhookEvent.filter({ event_id: eventId }))[0];
      if (failedLedger?.id) {
        await sr.entities.KoFiWebhookEvent.update(failedLedger.id, {
          side_effects_complete: false,
          last_error: 'Downstream side-effect recovery is explicitly required.',
        });
      }
      await markRecoveryRequired(sr, connection.id, eventId, claimToken);
      return Response.json({ error: safeWebhookError() }, { status: 500 });
    }

    return Response.json({ ok: true, claimed: true });
  } catch (error) {
    console.error('kofiWebhook error:', error);
    return Response.json({ error: safeWebhookError() }, { status: 500 });
  }
}
