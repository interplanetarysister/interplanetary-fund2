import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { IFUND_PAYPAL_ACCOUNT_REF, listTransactions } from '../../shared/paypal.ts';

const SUPER_ADMIN_OWNER_EMAILS = new Set([
  'cuddlemeplatonically@gmail.com',
  'interplanetarysister@gmail.com',
]);
const isSuperAdminOwner = (user) =>
  user?.role === 'admin' &&
  SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email || '').trim().toLowerCase());

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function byTransaction(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const id = String(row.provider_transaction_id || '');
    if (!id) continue;
    const current = groups.get(id) || [];
    current.push(row);
    groups.set(id, current);
  }
  return groups;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSuperAdminOwner(user)) {
      return Response.json({ error: 'Forbidden — super admin only.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(90, Number(body.lookback_days) || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const transactions = await listTransactions({ startDate: start, endDate: end, pageSize: 500 });

    const [paypalOps, paypalDonations, googlePayDonations, paypalHoldings] = await Promise.all([
      sr.entities.FinancialOperation.filter({ provider: 'paypal' }, '-created_date', 5000).catch(() => []),
      sr.entities.Donation.filter({ payment_method: 'paypal' }, '-created_date', 5000).catch(() => []),
      sr.entities.Donation.filter({ payment_method: 'googlepay' }, '-created_date', 5000).catch(() => []),
      sr.entities.HoldingLedgerEntry.filter({ source_provider: 'paypal' }, '-created_date', 5000).catch(() => []),
    ]);
    const opsByTransaction = byTransaction(paypalOps);
    const donationsByTransaction = byTransaction([...paypalDonations, ...googlePayDonations]);
    const holdingsByTransaction = byTransaction(paypalHoldings);

    const receipts = (transactions || [])
      .filter((tx) =>
        tx.status === 'S' &&
        tx.transactionEventCode === 'T0013' &&
        Number(tx.amount) > 0 &&
        String(tx.currency || '').toUpperCase() === 'USD'
      )
      .map((tx) => {
        const gross = round2(tx.amount);
        const fee = String(tx.feeCurrency || tx.currency || '').toUpperCase() === 'USD' ? round2(Math.abs(Number(tx.feeAmount || 0))) : 0;
        const ops = opsByTransaction.get(String(tx.id)) || [];
        const donations = donationsByTransaction.get(String(tx.id)) || [];
        const holdings = holdingsByTransaction.get(String(tx.id)) || [];
        const campaignIds = new Set([...ops, ...donations, ...holdings].map((row) => String(row.campaign_id || '')).filter(Boolean));
        const recovered = round2(Math.max(0, gross - fee));
        const op = ops.length === 1 ? ops[0] : null;
        const canonicalId = String(op?.id || '');
        const contribution = round2(op?.platform_contribution || 0);
        const contributions = new Set([...ops, ...donations, ...holdings].map((row) => round2(row.platform_contribution || 0)));
        const paymentChannels = new Set([
          ...ops.map((row) => String(row.payment_channel || '')),
          ...donations.map((row) => String(row.payment_method || '')),
          ...holdings.map((row) => String(row.payment_channel || '')),
        ].filter(Boolean));
        const paymentChannel = paymentChannels.size === 1 ? [...paymentChannels][0] : '';
        const operationComplete = !!op && op.operation_type === 'donation' && op.state === 'applied' && op.provider === 'paypal' &&
          op.payment_channel === paymentChannel && round2(op.gross_amount) === recovered &&
          round2(op.processing_fee || 0) === fee && contribution >= 0 && contribution <= recovered;
        const donationComplete = donations.length === 1 && donations.every((row) =>
          row.payment_verified === true && ['paypal', 'googlepay'].includes(row.payment_method) &&
          String(row.canonical_operation_id || '') === canonicalId && round2(row.amount) === recovered &&
          round2(row.processing_fee || 0) === fee && round2(row.platform_contribution || 0) === contribution
        );
        const holdingComplete = holdings.length === 1 && holdings.every((row) =>
          row.state === 'settled' && row.direction === 'in' && row.source_provider === 'paypal' &&
          row.source_account_ref === IFUND_PAYPAL_ACCOUNT_REF && row.payment_channel === paymentChannel &&
          String(row.currency || '').toUpperCase() === 'USD' && String(row.canonical_operation_id || '') === canonicalId &&
          round2(row.amount) === recovered && round2(row.processing_fee || 0) === fee &&
          round2(row.platform_contribution || 0) === contribution
        );
        const complete = campaignIds.size === 1 && contributions.size <= 1 && paymentChannels.size === 1 &&
          ['paypal', 'googlepay'].includes(paymentChannel) && operationComplete && donationComplete && holdingComplete;
        const hasLocalEvidence = ops.length + donations.length + holdings.length > 0;
        const allocationConflict = campaignIds.size > 1 || contributions.size > 1 || paymentChannels.size > 1 ||
          [...paymentChannels].some((channel) => !['paypal', 'googlepay'].includes(channel)) ||
          ops.some((row) => row.provider !== 'paypal' || round2(row.gross_amount) !== recovered || round2(row.processing_fee || 0) !== fee) ||
          donations.some((row) => round2(row.amount) !== recovered || round2(row.processing_fee || 0) !== fee) ||
          holdings.some((row) => row.source_provider !== 'paypal' || row.source_account_ref !== IFUND_PAYPAL_ACCOUNT_REF ||
            round2(row.amount) !== recovered || round2(row.processing_fee || 0) !== fee);
        return {
          transaction_id: tx.id,
          gross_amount: gross,
          fee_amount: fee,
          recoverable_amount: recovered,
          currency: 'USD',
          transaction_event_code: tx.transactionEventCode || '',
          subject: String(tx.transactionSubject || '').slice(0, 250),
          note: String(tx.transactionNote || '').slice(0, 500),
          occurred_at: tx.transactionUpdatedDate || tx.transactionInitiationDate || '',
          tracked: complete,
          repair_required: hasLocalEvidence && !complete,
          allocation_conflict: allocationConflict,
          allocation_campaign_id: campaignIds.size === 1 && !allocationConflict ? [...campaignIds][0] : '',
        };
      })
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));

    return Response.json({
      ok: true,
      lookback_days: days,
      receipts,
      checked_transactions: transactions.length,
      eligible_settled_receipts: receipts.length,
      untracked_count: receipts.filter((row) => !row.tracked).length,
    });
  } catch (error) {
    console.error('listUntrackedPayPalReceipts error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: 'PayPal receipts could not be reviewed safely.' }, { status: 500 });
  }
}
