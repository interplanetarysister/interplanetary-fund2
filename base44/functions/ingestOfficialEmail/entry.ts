import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Signed server-to-server entrypoint for Cloudflare's separate Email Worker.
// Never expose the secret, owner user ID, or this privileged route in frontend code.
const textEncoder = new TextEncoder();

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

async function signedHex(payload: string, timestamp: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${timestamp}.${payload}`));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function allowedRecipient(address: string, configured: string): boolean {
  const normalized = address.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@interplanetaryfund\.com$/.test(normalized)) return false;
  return configured.split(',').map((value) => value.trim().toLowerCase())
    .filter(Boolean).includes(normalized);
}

export default async function (req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const secret = Deno.env.get('IFUND_MAIL_INGEST_SHARED_SECRET') || '';
  const ownerId = Deno.env.get('IFUND_MAIL_OWNER_USER_ID') || '';
  const allowedAddresses = Deno.env.get('IFUND_MAIL_ALLOWED_ADDRESSES') || '';
  if (secret.length < 32 || !ownerId || !allowedAddresses) {
    return Response.json({ error: 'Official inbox is not configured.' }, { status: 503 });
  }

  try {
    const timestamp = req.headers.get('x-ifund-mail-timestamp') || '';
    const signature = req.headers.get('x-ifund-mail-signature') || '';
    if (!/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) {
      return Response.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    if (Math.abs(Date.now() - Number(timestamp)) > 300000) {
      return Response.json({ error: 'Expired request.' }, { status: 401 });
    }

    const raw = await req.text();
    if (raw.length > 64000) return Response.json({ error: 'Request too large.' }, { status: 413 });
    const expected = await signedHex(raw, timestamp, secret);
    if (!constantTimeEqual(signature, expected)) {
      return Response.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const data = JSON.parse(raw);
    const id = String(data?.id || '').trim().toLowerCase();
    const recipient = String(data?.to || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(id) || !allowedRecipient(recipient, allowedAddresses)) {
      return Response.json({ error: 'Invalid mailbox or message.' }, { status: 400 });
    }
    const sender = String(data?.from || '').trim().slice(0, 320);
    if (!/^[^\s@]{1,64}@[^\s@]{1,255}$/.test(sender)) {
      return Response.json({ error: 'Invalid sender.' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const owner = await sr.entities.User.get(ownerId).catch(() => null);
    if (!owner || !['admin', 'super_admin'].includes(owner.role) ||
        owner.account_deletion_pending ||
        (owner.account_status && owner.account_status !== 'active')) {
      return Response.json({ error: 'Mailbox owner is unavailable.' }, { status: 503 });
    }
    const externalMessageId = `${recipient}:${id}`;
    const existing = await sr.entities.InboxItem.filter({
      user_id: ownerId, platform: 'email', external_message_id: externalMessageId,
    }, '-created_date', 1);
    if (existing?.length) return Response.json({ ok: true, duplicate: true });

    const subject = String(data?.subject || '(no subject)').slice(0, 240);
    const body = String(data?.text || '').slice(0, 12000);
    const attachments = Math.min(100, Math.max(0, Math.trunc(Number(data?.attachment_count) || 0)));
    const content = `To: ${recipient}\nSubject: ${subject}\n\n${body}` +
      (attachments > 0 ? `\n\n${attachments} attachment(s) stored privately; opening them in IFund is not enabled yet.` : '');
    await sr.entities.InboxItem.create({
      user_id: ownerId,
      platform: 'email',
      type: 'message',
      author: sender,
      content,
      external_message_id: externalMessageId,
      status: 'open',
      reply_support: 'unknown',
    });
    return Response.json({ ok: true, duplicate: false });
  } catch (error) {
    // Avoid logging the raw email, credentials, headers, or private content.
    console.error('ingestOfficialEmail failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Email could not be saved.' }, { status: 500 });
  }
}
