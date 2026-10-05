import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { listTransactions } from '../../shared/paypal.ts';

const SUPER_ADMIN_OWNER_EMAILS = new Set([
  'cuddlemeplatonically@gmail.com',
  'interplanetarysister@gmail.com',
]);
const isSuperAdminOwner = (user) =>
  user?.role === 'admin' &&
  SUPER_ADMIN_OWNER_EMAILS.has(String(user?.email || '').trim().toLowerCase());

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
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

    const [paypalOps, paypalDonations, paypalHoldings] = await Promise.all([
      sr.entities.FinancialOperation.filter({ provider: 'paypal' }, '-created_date', 5000).catch(() => []),
      sr.entities.Donation.filter({ payment_method: 'paypal' }, '-created_date', 5000).catch(() => []),
      sr.entities.HoldingLedgerEntry.filter({ source_provider: 'paypal' }, '-created_date', 5000).catch(() => []),
    ]);
    const tracked = new Set([
      ...(paypalOps || []).map((row) => String(row.provider_transaction_id || '')).filter(Boolean),
      ...(paypalDonations || []).map((row) => String(row.provider_transaction_id || '')).filter(Boolean),
      ...(paypalHoldings || []).map((row) => String(row.provider_transaction_id || '')).filter(Boolean),
    ]);

    const receipts = (transactions || [])
      .filter((tx) =>
        tx.status === 'S' &&
        tx.transactionEventCode === 'T0013' &&
        Number(tx.amount) > 0 &&
        String(tx.currency || '').toUpperCase() === 'USD'
      )
      .map((tx) => {
        const gross = round2(tx.amount);
        const fee = String(tx.feeCurrency || tx.currency || '').toUpperCase() === 'USD' ? round2(tx.feeAmount || 0) : 0;
        return {
          transaction_id: tx.id,
          gross_amount: gross,
          fee_amount: fee,
          recoverable_amount: round2(Math.max(0, gross - fee)),
          currency: 'USD',
          transaction_event_code: tx.transactionEventCode || '',
          subject: String(tx.transactionSubject || '').slice(0, 250),
          note: String(tx.transactionNote || '').slice(0, 500),
          occurred_at: tx.transactionUpdatedDate || tx.transactionInitiationDate || '',
          tracked: tracked.has(String(tx.id)),
        };
      })
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));

    return Response.json({
      ok: true,
      lookback_days: days,
      receipts,
      untracked_count: receipts.filter((row) => !row.tracked).length,
    });
  } catch (error) {
    console.error('listUntrackedPayPalReceipts error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: 'PayPal receipts could not be reviewed safely.' }, { status: 500 });
  }
}
