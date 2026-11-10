import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Donation breakdown by funding platform for one campaign, derived only from
// the campaign owner's verified ledger: confirmed FinancialOperation donations
// plus settled external-platform custody entries. Owner/admin only.

const MAX_ROWS = 5000;
const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const PLATFORM_LABELS = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  cashapp: 'Cash App',
  googlepay: 'Google Pay',
  applepay: 'Apple Pay',
  kofi: 'Ko-fi',
  buymeacoffee: 'Buy Me a Coffee',
  givebutter: 'Givebutter',
  donorbox: 'Donorbox',
  gofundme: 'GoFundMe',
  fundly: 'Fundly',
  kickstarter: 'Kickstarter',
  indiegogo: 'Indiegogo',
  givesendgo: 'GiveSendGo',
  spotfund: 'SpotFund',
  fundrazr: 'FundRazr',
  patreon: 'Patreon',
  justgiving: 'JustGiving',
  eventbrite: 'Eventbrite',
  wix: 'Wix',
  custom: 'Direct link',
  interplanetary_fund: 'Interplanetary Fund checkout',
};

const labelFor = (provider) => {
  const key = String(provider || '').toLowerCase();
  if (!key) return 'Interplanetary Fund checkout';
  return PLATFORM_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const campaign_id = body.campaign_id;
    if (!campaign_id) return Response.json({ error: 'Campaign is required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the campaign owner can see this breakdown.' }, { status: 403 });
    }

    const [operations, holdings] = await Promise.all([
      sr.entities.FinancialOperation.filter({ campaign_id }, '-created_date', MAX_ROWS).catch(() => []),
      sr.entities.HoldingLedgerEntry.filter({ campaign_id }, '-created_date', MAX_ROWS).catch(() => []),
    ]);
    if (!Array.isArray(operations) || !Array.isArray(holdings)) {
      return Response.json({ error: 'Could not read the campaign ledger.' }, { status: 500 });
    }
    if (operations.length >= MAX_ROWS || holdings.length >= MAX_ROWS) {
      return Response.json({ error: 'This campaign ledger is too large for one request.' }, { status: 409 });
    }

    const buckets = new Map();
    const add = ({ platform, currency, amount, count }) => {
      const key = `${platform}|${currency}`;
      const existing = buckets.get(key) || { platform, currency, amount: 0, count: 0 };
      existing.amount = round2(existing.amount + amount);
      existing.count += count;
      buckets.set(key, existing);
    };

    for (const op of operations) {
      if (op.operation_type !== 'donation') continue;
      if (!['applied', 'completed'].includes(op.state)) continue;
      // Sandbox test money never mixes into live platform analytics.
      if (String(op.environment || 'live') === 'sandbox') continue;
      const amount = Number(op.gross_amount || 0);
      if (!(amount > 0)) continue;
      add({
        platform: String(op.provider || op.payment_channel || 'interplanetary_fund').toLowerCase(),
        currency: String(op.currency || 'USD').toUpperCase(),
        amount,
        count: 1,
      });
    }

    // External platform money only: processor custody entries for IFund's own
    // checkout would double count the operations above.
    for (const entry of holdings) {
      if (entry.direction !== 'in' || entry.state !== 'settled') continue;
      if (entry.source_type !== 'external_platform') continue;
      if (String(entry.environment || 'live') === 'sandbox') continue;
      if (!entry.source_provider) continue;
      const amount = Number(entry.amount || 0);
      if (!(amount > 0)) continue;
      add({
        platform: String(entry.source_provider).toLowerCase(),
        currency: String(entry.currency || 'USD').toUpperCase(),
        amount,
        count: 1,
      });
    }

    const totals = new Map();
    for (const bucket of buckets.values()) {
      const total = totals.get(bucket.currency) || { currency: bucket.currency, amount: 0, count: 0 };
      total.amount = round2(total.amount + bucket.amount);
      total.count += bucket.count;
      totals.set(bucket.currency, total);
    }

    const platforms = [...buckets.values()]
      .map((bucket) => {
        const total = totals.get(bucket.currency) || { amount: 0 };
        return {
          platform: bucket.platform,
          label: labelFor(bucket.platform),
          currency: bucket.currency,
          amount: bucket.amount,
          count: bucket.count,
          share: total.amount > 0 ? Math.round((bucket.amount / total.amount) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return Response.json({
      ok: true,
      campaign_id,
      platforms,
      totals: [...totals.values()].map((total) => ({ ...total, amount: round2(total.amount) })),
      mixed_currency: totals.size > 1,
      currency: totals.size === 1 ? [...totals.keys()][0] : null,
    });
  } catch (error) {
    console.error('getCampaignPlatformAnalytics error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to load the platform breakdown.' }, { status: 500 });
  }
}