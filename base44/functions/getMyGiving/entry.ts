import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { giftOf, round2 } from '../../shared/fees.js';

// Signed-in donor only. Provider-verified financial operations are the source
// of truth; checkout intents and browser callbacks do not create giving totals.
export default async function(req) {
  try {
    const b = createClientFromRequest(req);
    const account = await assertActiveAccount(b);
    if (!account.ok) return Response.json({ error: account.error }, { status: account.status });
    const user = await b.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Authentication required.' }, { status: 401 });
    const sr = b.asServiceRole;
    const [donationRows, orderRows] = await Promise.all([
      sr.entities.Donation.filter({ donor_user_id: user.id }, '-created_date', 1000),
      sr.entities.PayPalOrder.filter({ donor_user_id: user.id }, '-created_date', 500),
    ]);
    if (!Array.isArray(donationRows) || !Array.isArray(orderRows)) throw Error('Unable to retrieve financial records');
    const paypalByCapture = new Map();
    const paypalByOrder = new Map();
    for (const row of orderRows) {
      if (row.donor_user_id !== user.id) continue;
      if (row.capture_id) paypalByCapture.set(String(row.capture_id), row);
      if (row.order_id) paypalByOrder.set(String(row.order_id), row);
    }
    const history = [];
    const capturedIds = new Set();
    for (const d of donationRows) {
      if (d.donor_user_id !== user.id || d.payment_verified !== true || !d.canonical_operation_id) continue;
      const operation = await sr.entities.FinancialOperation.get(d.canonical_operation_id).catch(() => null);
      if (!operation || operation.operation_type !== 'donation' || operation.state !== 'applied' ||
          operation.campaign_id !== d.campaign_id || !operation.provider_transaction_id ||
          String(operation.provider_transaction_id) !== String(d.provider_transaction_id)) continue;
      const environment = operation.environment === 'sandbox' ? 'sandbox' : 'live';
      if (d.environment && d.environment !== environment) continue;
      const captureKey = String(operation.provider_transaction_id);
      if (capturedIds.has(environment + ':' + captureKey)) continue;
      capturedIds.add(environment + ':' + captureKey);
      const related = paypalByCapture.get(captureKey);
      const status = related?.state === 'refunded' ? 'refunded' : related?.state === 'reversed' ? 'reversed' : 'completed';
      const amount = round2(giftOf(d));
      if (!Number.isFinite(amount) || amount < 0) continue;
      history.push({
        id: String(d.id), campaign_id: d.campaign_id, campaign_title: d.campaign_title || 'Campaign',
        amount, currency: 'USD', status, environment,
        platform_support_amount: round2(Number(d.platform_contribution || 0)),
        processing_fee: round2(Number(d.processing_fee || 0)),
        total_charged: round2(Number(d.amount || 0) + Number(d.processing_fee || 0)),
        payment_method: d.payment_method || 'other', created_date: d.created_date,
        reference: captureKey.slice(-8), receipt_available: status === 'completed',
      });
    }
    // Pending/failed/cancelled intents are visible as status, never as verified gifts.
    for (const row of orderRows) {
      if (row.donor_user_id !== user.id || !row.order_id || row.state === 'captured' ||
          (row.capture_id && capturedIds.has(String(row.environment) + ':' + String(row.capture_id)))) continue;
      const status = row.state === 'refunded' ? 'refunded' :
        row.state === 'reversed' ? 'reversed' :
        row.state === 'failed' || row.state === 'denied' ? 'failed' :
        row.state === 'cancelled' ? 'cancelled' : 'pending';
      history.push({
        id: 'order-' + row.id, campaign_id: row.campaign_id, campaign_title: row.campaign_title || 'Campaign',
        amount: round2(Number(row.validated_gift || 0)), currency: row.currency || 'USD',
        status, environment: row.environment === 'sandbox' ? 'sandbox' : 'live',
        created_date: row.created_at || row.created_date, payment_method: row.payment_channel || 'paypal',
        reference: String(row.order_id).slice(-8), receipt_available: false,
      });
    }
    history.sort((a, z) => new Date(z.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());
    return Response.json({ donations: history, recurring_supported: false, verified_source: 'canonical_financial_operations' });
  } catch (error) {
    console.error('getMyGiving failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to load verified giving records.' }, { status: 503 });
  }
}