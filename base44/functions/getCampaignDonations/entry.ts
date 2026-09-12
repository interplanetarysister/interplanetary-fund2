import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_ID_LENGTH = 128;
const MAX_ROWS = 1000;
const MAX_TEXT_LENGTH = 500;
const MAX_AMOUNT = 100_000_000;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function diagnosticType(error) {
  const tag = Object.prototype.toString.call(error);
  if (tag === '[object Error]') return typeof error?.name === 'string' ? error.name.slice(0, 64) : 'Error';
  if (typeof error === 'string') return 'string';
  if (error === null) return 'null';
  if (Array.isArray(error)) return 'array';
  return typeof error;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeId(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.trim().length <= MAX_ID_LENGTH
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function boundedText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return normalized.slice(0, MAX_TEXT_LENGTH);
}

function safeDate(value) {
  return typeof value === 'string' && SAFE_DATE.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

function projectDonation(row, includePrivateFields) {
  if (!isPlainObject(row)) return null;
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return null;
  const createdDate = safeDate(row.created_date);
  if (!createdDate) return null;
  if (typeof row.payment_verified !== 'boolean') return null;
  if (typeof row.id !== 'string' || !isSafeId(row.id)) return null;

  const base = {
    id: row.id.trim(),
    donor_name: boundedText(row.donor_name, 'Anonymous') || 'Anonymous',
    amount,
    is_recurring: typeof row.is_recurring === 'boolean' ? row.is_recurring : false,
    message: boundedText(row.message),
    created_date: createdDate,
    payment_verified: row.payment_verified,
  };

  if (!includePrivateFields) {
    delete base.id;
    delete base.payment_verified;
  }
  return base;
}

export default async function (req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', Allow: 'POST' },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* public visitors */ }

    let body;
    try { body = await req.json(); } catch (_) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (!isPlainObject(body)) return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const keys = Object.keys(body);
    if (keys.some((key) => !['campaign_id', 'include_pending'].includes(key))) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const campaignId = typeof body.campaign_id === 'string' ? body.campaign_id.trim() : body.campaign_id;
    if (!isSafeId(campaignId)) return Response.json({ error: 'Campaign is required' }, { status: 400 });
    if (body.include_pending !== undefined && typeof body.include_pending !== 'boolean') {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const includePending = body.include_pending === true;

    let campaign;
    try { campaign = await sr.entities.Campaign.get(campaignId); } catch (error) {
      console.error('getCampaignDonations campaign lookup failed', { diagnostic_type: diagnosticType(error) });
      return Response.json({ error: 'Unable to load donations.' }, { status: 500 });
    }
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const isOwner = !!user && campaign.created_by_id === user.id;
    const isAdmin = !!user && user.role === 'admin';
    if (campaign.status === 'draft' && !isOwner && !isAdmin) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    let allDonations;
    try {
      allDonations = await sr.entities.Donation.filter({ campaign_id: campaignId }, '-created_date', MAX_ROWS + 1);
    } catch (error) {
      console.error('getCampaignDonations donation lookup failed', { diagnostic_type: diagnosticType(error) });
      return Response.json({ error: 'Unable to load donations.' }, { status: 500 });
    }
    if (!Array.isArray(allDonations) || allDonations.length > MAX_ROWS) {
      return Response.json({ error: 'Unable to load donations.' }, { status: 502 });
    }

    const projected = allDonations.map((row) => projectDonation(row, isOwner || isAdmin));
    if (projected.some((row) => row === null)) {
      return Response.json({ error: 'Unable to load donations.' }, { status: 502 });
    }

    const confirmed = projected.filter((row) => row.payment_verified === true);
    const pending = projected.filter((row) => row.payment_verified !== true);

    if (isOwner || isAdmin) {
      const donations = includePending ? projected : confirmed;
      return Response.json({ donations, pending_count: pending.length });
    }

    const safe = confirmed.map(({ donor_name, amount, is_recurring, message, created_date }) => ({
      donor_name,
      amount,
      is_recurring,
      message,
      created_date,
    }));
    return Response.json({ donations: safe });
  } catch (error) {
    console.error('getCampaignDonations failed', { diagnostic_type: diagnosticType(error) });
    return Response.json({ error: 'Unable to load donations.' }, { status: 500 });
  }
}
