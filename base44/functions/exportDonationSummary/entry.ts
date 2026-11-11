import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const PLATFORM_LABELS = {
  paypal: 'PayPal',
  card: 'Credit or debit card (PayPal)',
  googlepay: 'Google Pay',
  applepay: 'Apple Pay',
  cashapp: 'Cash App',
  stripe: 'Stripe card',
  stripe_crypto: 'Stripe crypto',
  other: 'Other / unverified source',
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Admin-only accounting summary. Returns one clean row per donation in a date
// range with the payment platform that actually processed it. Pending
// (unverified) reports are excluded unless explicitly requested.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Administrator access is required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const startDate = DATE_ONLY.test(String(body.start_date || '')) ? String(body.start_date) : new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const endDate = DATE_ONLY.test(String(body.end_date || '')) ? String(body.end_date) : today;
    if (startDate > endDate) {
      return Response.json({ error: 'The start date must be on or before the end date.' }, { status: 400 });
    }
    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;
    const includePending = body.include_pending === true;
    const environment = body.environment === 'all' ? 'all' : body.environment === 'sandbox' ? 'sandbox' : 'live';

    const sr = base44.asServiceRole;
    const raw = await sr.entities.Donation.filter(
      { created_date: { $gte: startIso, $lte: endIso } },
      '-created_date',
      2000,
    );
    if (!Array.isArray(raw)) throw new Error('Unable to read donations');

    const rows = raw
      .filter((d) => d.created_date >= startIso && d.created_date <= endIso)
      .filter((d) => environment === 'all' || String(d.environment || 'live') === environment)
      .filter((d) => includePending || d.payment_verified === true)
      .map((d) => {
        const platform = String(d.payment_method || 'other').toLowerCase();
        return {
          id: d.id,
          created_date: d.created_date,
          campaign_id: d.campaign_id,
          campaign_title: d.campaign_title || 'Campaign',
          donor_name: d.donor_name || 'Anonymous',
          platform,
          platform_label: PLATFORM_LABELS[platform] || PLATFORM_LABELS.other,
          environment: String(d.environment || 'live'),
          verified: d.payment_verified === true,
          amount: round2(d.amount),
          processing_fee: round2(d.processing_fee),
          platform_contribution: round2(d.platform_contribution),
          total_charged: round2(Number(d.amount || 0) + Number(d.processing_fee || 0)),
          reference: d.provider_transaction_id || d.stripe_session_id || '',
        };
      });

    const byPlatform = {};
    let grossTotal = 0;
    let feeTotal = 0;
    let contributionTotal = 0;
    for (const row of rows) {
      grossTotal += row.amount;
      feeTotal += row.processing_fee;
      contributionTotal += row.platform_contribution;
      byPlatform[row.platform] = round2((byPlatform[row.platform] || 0) + row.amount);
    }

    return Response.json({
      range: { start_date: startDate, end_date: endDate },
      environment,
      include_pending: includePending,
      rows,
      totals: {
        count: rows.length,
        gross: round2(grossTotal),
        processing_fees: round2(feeTotal),
        platform_contributions: round2(contributionTotal),
        by_platform: byPlatform,
      },
      platform_labels: PLATFORM_LABELS,
      truncated: raw.length >= 2000,
    });
  } catch (error) {
    console.error('exportDonationSummary failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to build the donation summary.' }, { status: 503 });
  }
}