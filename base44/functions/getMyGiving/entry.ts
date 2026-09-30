import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_ROWS = 1000;
const MAX_TEXT = 240;
const MAX_AMOUNT = 1_000_000_000;
const ALLOWED_KEYS = new Set(['']);
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function diagnosticType(value) {
  const tag = Object.prototype.toString.call(value);
  if (tag === '[object Error]') return 'error';
  if (tag === '[object String]') return 'string';
  if (tag === '[object Object]') return 'object';
  if (tag === '[object Null]') return 'null';
  return 'other';
}

function boundedText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return cleaned.length > MAX_TEXT ? cleaned.slice(0, MAX_TEXT) : cleaned;
}

function requiredId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || /[\u0000-\u001F\u007F]/.test(normalized)) return null;
  return normalized;
}

function safeDate(value) {
  if (typeof value !== 'string' || value.length > 64 || !ISO_UTC.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? value : null;
}

function safeAmount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return null;
  return Math.round(value * 100) / 100;
}

function safeBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function projectDonation(row, userId) {
  if (!row || typeof row !== 'object') return null;
  const id = requiredId(row.id);
  const donorUserId = requiredId(row.donor_user_id);
  const campaignId = requiredId(row.campaign_id);
  const amount = safeAmount(row.amount);
  const createdDate = safeDate(row.created_date);
  const isRecurring = safeBoolean(row.is_recurring);
  if (!id || !donorUserId || donorUserId !== userId || !campaignId || amount === null || !createdDate || isRecurring === null) return null;

  const recurringStatus = row.recurring_status === undefined ? (isRecurring ? 'active' : undefined) : boundedText(row.recurring_status, '');
  const paymentMethod = row.payment_method === undefined ? 'other' : boundedText(row.payment_method, '');
  if (row.recurring_status !== undefined && !recurringStatus) return null;
  if (row.payment_method !== undefined && !paymentMethod) return null;

  return {
    id,
    campaign_id: campaignId,
    campaign_title: boundedText(row.campaign_title, ''),
    amount,
    donor_name: boundedText(row.donor_name, 'Anonymous') || 'Anonymous',
    is_recurring: isRecurring,
    ...(recurringStatus ? { recurring_status: recurringStatus } : {}),
    payment_method: paymentMethod || 'other',
    created_date: createdDate,
  };
}

export default async function(req) {
  try {
    if (req?.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json' } });
    let body = {};
    if (req?.body) {
      try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !ALLOWED_KEYS.has(key))) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      console.error('getMyGiving auth failure:', diagnosticType(authError));
      return Response.json({ error: 'Unable to authenticate.' }, { status: 500 });
    }
    const userId = requiredId(user?.id);
    if (!userId) return Response.json({ error: 'Authentication required.' }, { status: 401 });

    const rows = await base44.asServiceRole.entities.Donation.filter(
      { donor_user_id: userId, payment_verified: true },
      '-created_date',
      MAX_ROWS,
    );
    if (!Array.isArray(rows) || rows.length > MAX_ROWS) return Response.json({ error: 'Unable to load giving history.' }, { status: 502 });

    const donations = rows.map((row) => projectDonation(row, userId));
    if (donations.some((row) => row === null)) return Response.json({ error: 'Unable to load giving history.' }, { status: 502 });

    return Response.json({ donations });
  } catch (error) {
    console.error('getMyGiving error:', diagnosticType(error));
    return Response.json({ error: 'Unable to load giving history.' }, { status: 500 });
  }
}
