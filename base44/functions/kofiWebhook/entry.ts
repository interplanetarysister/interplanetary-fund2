import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function safeWebhookError() {
  return 'Unable to process Ko-fi webhook.';
}

// Live Ko-fi donation sync. Ko-fi POSTs form-encoded webhooks with a `data`
// JSON field containing a verification_token. The token authenticates the
// request: it must match the token the connection owner saved when connecting
// Ko-fi. On match, external totals update and the gift lands in the owner's
// Universal Inbox. Public endpoint — service role, token-validated.
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

    const connections = await sr.entities.PlatformConnection.filter({ platform: 'kofi' });
    const connection = connections.find((c) => c.credentials?.kofi_verification_token === token);
    if (!connection) return Response.json({ error: 'Unknown verification token' }, { status: 401 });

    // Ko-fi retries failed webhook deliveries with the same message_id. Keep
    // the identifier in the connection history so sequential replays are not
    // counted twice. A durable atomic claim still requires a dedicated data
    // primitive and remains a separate production gate in Issue #66.
    const history = Array.isArray(connection.history) ? connection.history : [];
    const alreadyProcessed = history.some((event) => event?.messageId === messageId);
    if (alreadyProcessed) return Response.json({ ok: true, duplicate: true });

    const now = new Date().toISOString();
    await sr.entities.PlatformConnection.update(connection.id, {
      external_total: (connection.external_total || 0) + amount,
      external_donor_count: (connection.external_donor_count || 0) + 1,
      status: 'connected',
      last_synced: now,
      last_error: '',
      history: [
        ...history,
        {
          at: now,
          event: 'synced',
          messageId,
          detail: `Ko-fi ${payload.type || 'donation'}: $${amount} from ${payload.from_name || 'a supporter'}`,
        },
      ].slice(-30),
    });

    await sr.entities.InboxItem.create({
      user_id: connection.created_by_id,
      platform: 'kofi',
      campaign_id: connection.campaign_id,
      type: 'donation',
      author: payload.from_name || 'Ko-fi supporter',
      content: `Gave $${amount}${payload.message ? ` — "${payload.message}"` : ''}`,
      link: payload.url || connection.external_url || '',
      status: 'open',
    });
    await sr.entities.Notification.create({
      user_id: connection.created_by_id,
      title: 'New Ko-fi donation',
      body: `${payload.from_name || 'A supporter'} gave $${amount} on Ko-fi`,
      type: 'donation',
      link: '/inbox',
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('kofiWebhook error:', error);
    return Response.json({ error: safeWebhookError() }, { status: 500 });
  }
}
