import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function parseEnvelope(body: any) {
  const event = body?.data && typeof body.data === 'object' ? body.data : body;
  const embedded = typeof event?.data === 'string'
    ? (() => { try { return JSON.parse(event.data); } catch { return {}; } })()
    : (event?.data || {});
  const eventId = String(event?.id || event?.eventId || body?.id || body?.eventId || '');
  const eventType = String(event?.eventType || [event?.entityFqdn, event?.slug].filter(Boolean).join('.') || body?.eventType || 'unknown');
  return {
    eventId,
    eventType,
    instanceId: String(event?.instanceId || body?.instanceId || ''),
    entityId: String(event?.entityId || embedded?.entityId || ''),
    payload: embedded && Object.keys(embedded).length ? embedded : event,
  };
}

export default async function(req: Request) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const parsed = parseEnvelope(body);
    if (!parsed.eventId || parsed.eventType === 'unknown') {
      return Response.json({ error: 'Invalid Wix event envelope.' }, { status: 400 });
    }

    // Idempotency: Wix may retry delivery. Store each provider event once.
    const existing = (await sr.entities.ExternalSyncEvent.filter({ provider: 'wix', event_id: parsed.eventId }))[0];
    if (existing) return Response.json({ ok: true, duplicate: true, event_id: parsed.eventId });

    const now = new Date().toISOString();
    const record = await sr.entities.ExternalSyncEvent.create({
      provider: 'wix',
      event_id: parsed.eventId,
      event_type: parsed.eventType,
      entity_id: parsed.entityId,
      instance_id: parsed.instanceId,
      status: 'received',
      payload: parsed.payload,
      received_at: now,
    });

    // Webhooks are change signals, not proof that money entered IFund custody.
    // Financial Wix events therefore remain external observations until a
    // provider-backed settlement/reconciliation path verifies them.
    await sr.entities.ExternalSyncEvent.update(record.id, {
      status: 'processed',
      processed_at: new Date().toISOString(),
      last_error: '',
    });

    return Response.json({ ok: true, duplicate: false, event_id: parsed.eventId });
  } catch (error) {
    console.error('wixWebhook error:', error?.message || error);
    return Response.json({ error: 'Wix event could not be processed.' }, { status: 500 });
  }
}