import { secrets } from 'base44:runtime';
import { paypalApiBase, paypalCredentials } from './paypalEnvironment.ts';

// Read-only Payouts v1 verification. An HTTP 201 from Create Payouts means
// accepted for processing, NOT that an owner received money. A payout is paid
// only when the batch AND its single matching item report SUCCESS.
export async function verifyPayPalPayoutBatch(batchId: string, expected: {
  withdrawalId: string;
  receiver: string;
  amount: number;
  senderBatchId?: string;
}) {
  if (String(secrets.get('PAYPAL_MODE') || '') !== 'live')
    throw new Error('Live payout verification is unavailable.');
  const id = String(batchId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id))
    throw new Error('A verified PayPal payout batch reference is required.');
  const { clientId, clientSecret } = paypalCredentials('live');
  if (!clientId || !clientSecret) throw new Error('PayPal payout credentials unavailable.');

  const tokenResponse = await fetch(paypalApiBase('live') + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!tokenResponse.ok) throw new Error('PayPal did not authorize payout verification.');
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenData.access_token) throw new Error('PayPal payout authorization was incomplete.');

  const response = await fetch(
    paypalApiBase('live') + '/v1/payments/payouts/' + encodeURIComponent(id) + '?page_size=10',
    { headers: { Authorization: 'Bearer ' + tokenData.access_token, Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('PayPal payout batch status is unavailable.');
  const data = await response.json().catch(() => ({}));
  const header = data.batch_header || {};
  if (String(header.payout_batch_id || '') !== id)
    throw new Error('PayPal payout batch reference mismatch.');
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length !== 1) throw new Error('Payout must have exactly one attributable recipient.');

  const item = items[0] || {};
  const intended = item.payout_item || {};
  const actualAmount = intended.amount || {};
  const expectedItemId = 'ITEM_' + String(expected.withdrawalId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 70);
  const expectedAmount = Math.round(Number(expected.amount) * 100);
  const actualCents = Math.round(Number(actualAmount.value) * 100);
  const reference = String(intended.sender_item_id || '');
  const senderHeader = header.sender_batch_header || header.sender_payout_header || {};
  const senderBatchId = String(senderHeader.sender_batch_id || '');

  if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 ||
      !Number.isSafeInteger(actualCents) || actualCents !== expectedAmount ||
      String(actualAmount.currency || actualAmount.currency_code || '').toUpperCase() !== 'USD' ||
      String(intended.receiver || '').trim().toLowerCase() !== String(expected.receiver || '').trim().toLowerCase() ||
      reference !== expectedItemId ||
      (expected.senderBatchId && senderBatchId && senderBatchId !== expected.senderBatchId)) {
    throw new Error('PayPal payout item does not match the authorized withdrawal.');
  }

  const batchStatus = String(header.batch_status || '').toUpperCase();
  const itemStatus = String(item.transaction_status || '').toUpperCase();
  const paid = batchStatus === 'SUCCESS' && itemStatus === 'SUCCESS' &&
    Boolean(String(item.transaction_id || '').trim());
  const definitiveFailure =
    ['DENIED', 'CANCELED'].includes(batchStatus) ||
    ['FAILED', 'BLOCKED', 'RETURNED', 'REFUNDED', 'REVERSED'].includes(itemStatus);
  return {
    paid,
    definitiveFailure,
    batchStatus,
    itemStatus,
    batchId: id,
    senderBatchId,
    transactionId: paid ? String(item.transaction_id) : '',
    payoutItemId: String(item.payout_item_id || ''),
  };
}
