import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

// Cloudflare Email Worker -> IFund private InboxItem bridge.
// Fail closed unless the identical high-entropy shared secret is installed
// in Base44 and Cloudflare, and an admin recipient is configured.
const encoder = new TextEncoder();
const envValue = (name) => String(secrets.get(name) || '').trim();
const hex = (bytes) => [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, '0')).join('');
const clean = (value, max) => String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202e]/g, '').slice(0, max);
const priorityRecipients = new Set(["contact@interplanetaryfund.com","support@interplanetaryfund.com","admin@interplanetaryfund.com","ifund@interplanetaryfund.com","campaigns@interplanetaryfund.com","help@interplanetaryfund.com","developer@interplanetaryfund.com","partner@interplanetaryfund.com","crowdfund@interplanetaryfund.com"]);
const validRecipient = (address) => /^[^\s@<>\u0000-\u001f]{1,64}@interplanetaryfund\.com$/.test(address);

async function authenticate(req, body, secret) {
  const stamp = req.headers.get('x-ifund-email-timestamp') || '';
  const signature = (req.headers.get('x-ifund-email-signature') || '').toLowerCase();
  if (!/^\d{10}$/.test(stamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  if (Math.abs(Date.now() - Number(stamp) * 1000) > 300000) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(stamp + '.' + body)));
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}

export default async function (req) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const secret = envValue('IFUND_EMAIL_INGRESS_SECRET');
  const ownerId = envValue('IFUND_EMAIL_INBOX_OWNER_ID');
  if (secret.length < 32 || !ownerId) return Response.json({ error: 'Email intake not configured' }, { status: 503 });
  try {
    const raw = await req.text();
    if (raw.length > 65536) return Response.json({ error: 'Payload too large' }, { status: 413 });
    if (!(await authenticate(req, raw, secret))) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    let payload;
    try { payload = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const to = clean(payload?.to, 256).toLowerCase();
    if (!validRecipient(to)) {
      return Response.json({ error: 'Unknown recipient domain' }, { status: 400 });
    }
    const from = clean(payload?.from, 254);
    const subject = clean(payload?.subject, 240);
    const text = clean(payload?.text, 12000);
    const messageId = clean(payload?.message_id, 254).replace(/[<>]/g, '');
    if (!from || !messageId) return Response.json({ error: 'Missing message metadata' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const owner = await sr.entities.User.get(ownerId).catch(() => null);
    if (!owner || owner.role !== 'admin') return Response.json({ error: 'Mailbox owner not configured' }, { status: 503 });

    const providerMessageKey = (to + ':' + messageId).slice(0, 254);
    const previous = await sr.entities.InboxItem.filter({
      user_id: ownerId, platform: 'email', external_message_id: providerMessageKey,
    });
    if (previous?.length) return Response.json({ ok: true, duplicate: true });

    const row = await sr.entities.InboxItem.create({
      user_id: ownerId,
      platform: 'email',
      external_message_id: providerMessageKey,
      type: 'message',
      author: from,
      recipient_address: to,
      mailbox_priority: priorityRecipients.has(to) ? 'priority' : 'normal',
      content: 'Subject: ' + (subject || '(no subject)') + '\n\n' + (text || '(No plain-text body)'),
      status: 'open',
      reply_support: 'unsupported',
    });
    return Response.json({ ok: true, id: row.id });
  } catch (error) {
    console.error('receiveCloudflareEmail failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Email intake unavailable' }, { status: 500 });
  }
}
