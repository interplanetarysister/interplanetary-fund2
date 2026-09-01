import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Live Ko-fi donation sync. Ko-fi POSTs form-encoded webhooks with a `data`
// JSON field containing a verification_token. The token authenticates the
// request: it must match the token the connection owner saved when connecting
// Ko-fi. On match, external totals update and the gift lands in the owner's
// Universal Inbox.
//
// DURABLE IDEMPOTENCY: Ko-fi does not send a stable transaction id, so we
// derive a deterministic dedupe key from the stable payload fields (token,
// type, amount, currency, from_name, message, url, timestamp) via the cyrb53
// hash. A WebhookEvent claim is recorded before any side effect; a retry of the
// same event finds the claim and is skipped. If processing fails, the claim is
// released so Ko-fi's retry can reprocess. Public endpoint — service role,
// token-validated.

// cyrb53 — small, deterministic, well-distributed string hash (Pelle Wessman).
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

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

    const token = payload.verification_token;
    if (!token) return Response.json({ error: 'Missing verification token' }, { status: 401 });

    const connections = await sr.entities.PlatformConnection.filter({ platform: 'kofi' });
    const connection = connections.find((c) => c.credentials && c.credentials.kofi_verification_token === token);
    if (!connection) return Response.json({ error: 'Unknown verification token' }, { status: 401 });

    // Durable idempotency: deterministic key from stable payload fields.
    const stableFields = [
      String(token || ''),
      String(payload.type || ''),
      String(payload.amount || ''),
      String(payload.currency || ''),
      String(payload.from_name || ''),
      String(payload.message || ''),
      String(payload.url || ''),
      String(payload.timestamp || ''),
    ].join('|');
    const eventKey = `kofi:${connection.id}:${cyrb53(stableFields)}`;
    const prior = await sr.entities.WebhookEvent.filter({ source: 'kofi', event_key: eventKey }, '-created_date', 1);
    if (prior && prior.length) {
      return Response.json({ ok: true, duplicate: true });
    }
    const claim = await sr.entities.WebhookEvent.create({
      source: 'kofi',
      event_key: eventKey,
      processed_at: new Date().toISOString(),
    });

    try {
      const amount = parseFloat(payload.amount) || 0;
      const now = new Date().toISOString();
      // Atomic $inc for the financial counters prevents a read-modify-write
      // race when two Ko-fi webhooks land at the same time.
      await sr.entities.PlatformConnection.updateMany(
        { id: connection.id },
        {
          $inc: { external_total: amount, external_donor_count: 1 },
          $set: {
            status: 'connected',
            last_synced: now,
            last_error: '',
            history: [...(connection.history || []), { at: now, event: 'synced', detail: `Ko-fi ${payload.type || 'donation'}: $${amount} from ${payload.from_name || 'a supporter'}` }].slice(-30),
          },
        }
      );

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
    } catch (procErr) {
      // Processing failed — release the claim so Ko-fi's retry can reprocess.
      console.error('kofiWebhook processing error:', procErr && procErr.message ? procErr.message : procErr);
      await sr.entities.WebhookEvent.delete(claim.id).catch(() => {});
      throw procErr;
    }
  } catch (error) {
    console.error('kofiWebhook error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: 'Unable to process Ko-fi webhook' }, { status: 500 });
  }
}