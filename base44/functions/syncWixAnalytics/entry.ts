import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const conn = await base44.asServiceRole.connectors.getConnection('wix');
    if (!conn?.accessToken) return Response.json({ error: 'Wix is not connected.' }, { status: 409 });
    const end = new Date();
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0,10);
    const url = 'https://www.wixapis.com/analytics/v2/site-analytics/data';
    const requestBody = {
      dateRange: { startDate: fmt(start), endDate: fmt(end) },
      measurementTypes: ['TOTAL_SESSIONS','TOTAL_ORDERS','TOTAL_FORMS_SUBMITTED','TOTAL_UNIQUE_VISITORS','CLICKS_TO_CONTACT'],
    };
    // Wix's Analytics Data API is GET-with-JSON-body. Query-string encoding is
    // not equivalent to the documented request contract.
    const r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!r.ok) return Response.json({ error: 'Wix analytics are unavailable.', status: r.status }, { status: 502 });
    const body = await r.json();
    const sr = base44.asServiceRole;
    const externalId = `site-analytics-${fmt(start)}-${fmt(end)}`;
    const key = { provider: 'wix', record_type: 'analytics', external_id: externalId, owner_user_id: user.id };
    const existing = (await sr.entities.ExternalPlatformRecord.filter(key))[0];
    const value = { ...key, status: 'observed', data: body, observed_at: new Date().toISOString() };
    existing ? await sr.entities.ExternalPlatformRecord.update(existing.id, value) : await sr.entities.ExternalPlatformRecord.create(value);
    return Response.json({ ok: true, range: { start: fmt(start), end: fmt(end) }, data: body.data || [] });
  } catch (error) {
    console.error('syncWixAnalytics error:', error?.message || error);
    return Response.json({ error: 'Wix analytics could not be synchronized.' }, { status: 500 });
  }
}