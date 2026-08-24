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

// Live Ko-fi donation sync. Ko-fi POSTs form-encoded webhooks with a `data`
// JSON field containing a verification_token. The token authenticates the
// request: it must match the token the connection owner saved when connecting
// Ko-fi. The financial mutation is guarded by an atomic updateMany claim on
// the connection, separate from the rolling activity history.
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

    // First attempt the durable financial claim. The claim prevents duplicate
    // financial increments for the normal concurrent/retry path.
    const claim = await sr.entities.PlatformConnection.updateMany(
      {
        id: connection.id,
        processed_webhook_ids: { $ne: messageId },
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
          last_synced: new Date().toISOString(),
          last_error: '',
        },
        $push: {
          history: {
            at: new Date().toISOString(),
            event: 'synced',
            detail: `Ko-fi ${payload.type || 'donation'}: $${amount} from ${payload.from_name || 'a supporter'}`,
          },
        },
      },
    );

    if (!claim.success || claim.updated !== 1) {
      // A previously claimed event may have failed after the financial write.
      // Retry the side effects by their stable event identity instead of
      // returning early and permanently losing the Inbox/Notification path.
      await ensureSideEffects(sr, connection, payload, amount, eventId);
      return Response.json({ ok: true, duplicate: true, repaired: true });
    }

    await ensureSideEffects(sr, connection, payload, amount, eventId);

    return Response.json({ ok: true, claimed: true });
  } catch (error) {
    console.error('kofiWebhook error:', error);
    return Response.json({ error: safeWebhookError() }, { status: 500 });
  }
}
