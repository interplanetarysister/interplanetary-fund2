import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Server-side mailbox proxy: only authenticated IFund admins can read mail.
// Mail worker credentials MUST remain in Base44 server secrets, never the app.
const IDENTIFIER = /^[a-f0-9]{64}$/;

export default async function(req: Request) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const client = createClientFromRequest(req);
    const guard = await assertActiveAccount(client);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (guard.user.role !== 'admin') {
      return Response.json({ error: 'Administrator access required' }, { status: 403 });
    }

    const origin = (Deno.env.get('IFUND_MAIL_WORKER_URL') || '').replace(/\/+$/, '');
    const token = Deno.env.get('IFUND_MAIL_API_TOKEN') || '';
    if (!origin || !token) return Response.json({ error: 'Company email is not configured yet' }, { status: 503 });
    let url: URL;
    try { url = new URL(origin); }
    catch { return Response.json({ error: 'Company email configuration is invalid' }, { status: 503 }); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      return Response.json({ error: 'Company email configuration is invalid' }, { status: 503 });
    }

    const input = await req.json().catch(() => ({}));
    const action = String(input?.action || 'list');
    const id = String(input?.message_id || '');
    let resource = '/api/messages';
    let method = 'GET';
    if (action === 'list') resource += '?limit=100';
    else if (action === 'read' && IDENTIFIER.test(id)) resource += '/' + id;
    else if (action === 'mark_read' && IDENTIFIER.test(id)) {
      resource += '/' + id + '/read';
      method = 'POST';
    } else return Response.json({ error: 'Invalid mailbox action' }, { status: 400 });

    const endpoint = new URL(resource, url);
    const response = await fetch(endpoint, {
      method,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      // Do not relay provider errors, credentials, or upstream response bodies.
      return Response.json({ error: response.status === 404 ? 'Message not found' : 'Company email is unavailable' }, {
        status: response.status === 404 ? 404 : 503,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const payload = await response.json();
    return Response.json(payload, {
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    console.error('getCompanyMailbox failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Company email could not be loaded' }, { status: 503 });
  }
}
