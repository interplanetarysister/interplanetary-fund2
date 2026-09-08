import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { logAudit } from '../../shared/auditLog.ts';

const normalize = (value) => value.replace(/\r\n?/g, '\n')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();

// Reuses the existing SupportTicket entity. This suppresses sequential retries;
// a lookup plus create is NOT a cross-worker atomic uniqueness guarantee.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const access = await assertActiveAccount(base44);
    if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => !['request_id', 'subject', 'message'].includes(key)) ||
        typeof body.request_id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id) ||
        typeof body.subject !== 'string' || body.subject.length > 200 ||
        typeof body.message !== 'string' || body.message.length > 10000) {
      return Response.json({ error: 'Enter a subject of up to 200 characters and a message of up to 10,000 characters.' }, { status: 400 });
    }
    const subject = normalize(body.subject);
    const message = normalize(body.message);
    if (!message) return Response.json({ error: 'Enter a support message.' }, { status: 400 });
    const requestId = body.request_id.toLowerCase();
    const user = access.user;
    const tickets = base44.asServiceRole.entities.SupportTicket;
    const existing = await tickets.filter({ user_id: user.id, request_id: requestId }, 'created_date', 2);
    if (!Array.isArray(existing)) throw new Error('Invalid support lookup');
    if (existing.some((ticket) => ticket.user_id !== user.id || ticket.request_id !== requestId)) {
      throw new Error('Unexpected support lookup ownership');
    }
    if (existing.length) {
      const ticket = existing[0];
      if (existing.length > 1 || ticket.subject !== subject || ticket.message !== message) {
        return Response.json({ error: 'This request could not be reconciled. Please keep your message and contact support before resubmitting.' }, { status: 409 });
      }
      return Response.json({ success: true, ticket_id: ticket.id, duplicate: true });
    }
    const limit = await checkRateLimit(base44, `submitSupportTicket:${user.id}`, 5, 3600, { failClosed: true });
    if (!limit.allowed) {
      return Response.json({ error: limit.unavailable ? 'Support submission is temporarily unavailable. Please try again shortly.' :
        'Too many support requests. Please try again later.' }, {
        status: limit.unavailable ? 503 : 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      });
    }
    const ticket = await tickets.create({
      user_id: user.id,
      name: user.full_name || user.username || 'User',
      email: user.email || '',
      subject, message, request_id: requestId, status: 'open',
    });
    if (!ticket?.id) throw new Error('No ticket acknowledgement');
    await logAudit(base44, { action: 'support_ticket_submitted', actor_user_id: user.id,
      target_type: 'SupportTicket', target_id: ticket.id, detail: 'Support request submitted', status: 'success' });
    return Response.json({ success: true, ticket_id: ticket.id, duplicate: false });
  } catch {
    return Response.json({ error: 'Support request could not be submitted. Please retry the same request.' }, { status: 500 });
  }
}
