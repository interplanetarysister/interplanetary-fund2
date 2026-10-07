import { secrets } from "base44:runtime";

// Shared PayPal helpers. All platform money moves use deterministic provider
// request identities so retries cannot create a second capture or payout.

function apiBase() {
  return secrets.get("PAYPAL_MODE") === "live"
    ? "https://api.paypal.com"
    : "https://api.sandbox.paypal.com";
}

async function getAccessToken() {
  const id = secrets.get("PAYPAL_CLIENT_ID");
  const secret = secrets.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("PayPal credentials are not configured.");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${id}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

function stableProviderKey(prefix, value, max = 80) {
  return `${prefix}_${String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, max)}`;
}

export async function sendPayout({ receiver, amount, note, itemId }) {
  const token = await getAccessToken();
  const senderBatchId = stableProviderKey('IFW', itemId, 70);
  let res;
  try {
    res = await fetch(`${apiBase()}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Defense-in-depth alongside sender_batch_id. The same Base44
        // withdrawal always sends exactly the same provider request identity.
        "PayPal-Request-Id": senderBatchId,
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: "You received a payout from Interplanetary Fund",
          email_message: "Your campaign withdrawal has been processed.",
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: { value: Number(amount).toFixed(2), currency: "USD" },
            receiver,
            note,
            sender_item_id: stableProviderKey('ITEM', itemId, 70),
          },
        ],
      }),
    });
  } catch (cause) {
    // A transport failure is ambiguous: PayPal may have accepted the payout
    // before the connection dropped. Callers MUST keep the canonical reservation
    // and must not release/re-send funds under a new withdrawal id.
    const err = new Error("PayPal payout status is unknown after a transport failure.");
    err.ambiguous = true;
    err.sender_batch_id = senderBatchId;
    err.cause = cause;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = JSON.stringify(data || {}).toLowerCase();
    const duplicateOrAlreadySubmitted = raw.includes('sender_batch_id') && (raw.includes('already') || raw.includes('duplicate'));
    const err = new Error(data?.message || data?.error_description || `PayPal payout failed (${res.status})`);
    err.ambiguous = duplicateOrAlreadySubmitted;
    err.sender_batch_id = senderBatchId;
    err.http_status = res.status;
    throw err;
  }

  const batchId = data.batch_header?.payout_batch_id;
  const item = data.items?.[0];
  return {
    payout_batch_id: batchId,
    sender_batch_id: senderBatchId,
    transaction_status: item?.transaction_status || "PENDING",
  };
}

// Google Pay donations flow through the same PayPal business account as a
// standard PayPal v2 order: create an order on approval, capture it once the
// Google Pay payment data is confirmed.
export async function createOrder({ amount, description, customId, requestId }) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": stableProviderKey("IF_ORDER", requestId, 70) } : {}),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: Number(amount).toFixed(2) },
          description: (description || "Donation").slice(0, 120),
          ...(customId ? { custom_id: customId } : {}),
        },
      ],
      application_context: { shipping_preference: "NO_SHIPPING" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `PayPal order create failed (${res.status})`);
  return { id: data.id };
}

function normalizeOrderResult(data) {
  const unit = data?.purchase_units?.[0] || {};
  const captures = Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [];
  const capture = captures.find((row) => String(row?.status || '').toUpperCase() === 'COMPLETED') || captures[0] || null;
  const given = data?.payer?.name?.given_name || data?.payment_source?.paypal?.name?.given_name;
  const sur = data?.payer?.name?.surname || data?.payment_source?.paypal?.name?.surname;
  const parsedAmount = Number.parseFloat(capture?.amount?.value || '0');
  return {
    status: String(data?.status || ''),
    capture_status: String(capture?.status || ''),
    amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    payer_name: given ? `${given} ${sur || ''}`.trim() : '',
    custom_id: String(unit?.custom_id || ''),
    capture_id: String(capture?.id || ''),
    currency: String(capture?.amount?.currency_code || unit?.amount?.currency_code || '').toUpperCase(),
  };
}

export async function getOrder(orderId) {
  const id = String(orderId || '').trim();
  if (!id) throw new Error('PayPal order id is required.');
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `PayPal order lookup failed (${res.status})`);
  return normalizeOrderResult(data);
}

export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const stableRequestId = stableProviderKey('IF_CAPTURE', orderId, 70);
  let res;
  let data = {};
  let captureFailure = null;
  try {
    res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": stableRequestId,
      },
    });
    data = await res.json().catch(() => ({}));
    if (res.ok) return normalizeOrderResult(data);
    captureFailure = new Error(data?.message || `PayPal capture failed (${res.status})`);
  } catch (cause) {
    captureFailure = new Error('PayPal capture response was not received.');
    captureFailure.cause = cause;
  }

  // Capture is an irreversible provider action. If the response was lost, or a
  // retry reaches PayPal after the order was already captured, recover the
  // provider-authoritative order state instead of leaving real money outside
  // IFund's ledger. A GET is read-only and succeeds only when PayPal itself
  // reports a completed order with a completed capture.
  try {
    const recovered = await getOrder(orderId);
    if (
      recovered.status === 'COMPLETED' &&
      recovered.capture_status === 'COMPLETED' &&
      recovered.capture_id &&
      recovered.amount > 0
    ) {
      return { ...recovered, recovered_after_capture_error: true };
    }
  } catch (_) {
    // Preserve the original capture failure. A failed recovery lookup must not
    // turn an unknown or declined payment into a successful donation.
  }

  throw captureFailure || new Error('PayPal capture failed.');
}


// Verify a transaction against the designated business PayPal account before
// exterior funds are admitted to the custody ledger. This is intentionally a
// read-only provider check; it does not create financial value by itself.
export async function getTransaction(transactionId) {
  const id = String(transactionId || '').trim();
  if (!id) throw new Error('PayPal transaction id is required.');
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v1/reporting/transactions?transaction_id=${encodeURIComponent(id)}&fields=all&page_size=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `PayPal transaction lookup failed (${res.status})`);
  const details = Array.isArray(data?.transaction_details) ? data.transaction_details : [];
  const row = details.find((x) => String(x?.transaction_info?.transaction_id || '') === id);
  if (!row) return null;
  const info = row.transaction_info || {};
  const amount = info.transaction_amount || {};
  const fee = info.fee_amount || {};
  const parsedAmount = Number.parseFloat(amount.value || '0');
  const parsedFee = Math.abs(Number.parseFloat(fee.value || '0'));
  return {
    id: String(info.transaction_id || ''),
    status: String(info.transaction_status || ''),
    amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    currency: String(amount.currency_code || '').toUpperCase(),
    feeAmount: Number.isFinite(parsedFee) ? parsedFee : 0,
    feeCurrency: String(fee.currency_code || amount.currency_code || '').toUpperCase(),
    paypalAccountId: String(info.paypal_account_id || ''),
    transactionEventCode: String(info.transaction_event_code || ''),
    transactionSubject: String(info.transaction_subject || ''),
    transactionNote: String(info.transaction_note || ''),
    transactionInitiationDate: info.transaction_initiation_date || '',
    transactionUpdatedDate: info.transaction_updated_date || '',
  };
}


// Lists recent transactions visible to the designated business PayPal account.
// Used only for custody discovery; callers must still reconcile each candidate
// against an exterior observation before creating held value.
export async function listTransactions({ startDate, endDate, pageSize = 100 } = {}) {
  const token = await getAccessToken();
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 24 * 60 * 60 * 1000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    throw new Error('Invalid PayPal transaction search window.');
  }
  const size = Math.max(1, Math.min(500, Number(pageSize) || 100));
  const params = new URLSearchParams({
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    fields: 'all',
    page_size: String(size),
  });
  const res = await fetch(`${apiBase()}/v1/reporting/transactions?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `PayPal transaction search failed (${res.status})`);
  return (Array.isArray(data?.transaction_details) ? data.transaction_details : []).map((row) => {
    const info = row?.transaction_info || {};
    const amount = info.transaction_amount || {};
    const fee = info.fee_amount || {};
    const parsedAmount = Number.parseFloat(amount.value || '0');
    const parsedFee = Math.abs(Number.parseFloat(fee.value || '0'));
    return {
      id: String(info.transaction_id || ''),
      status: String(info.transaction_status || ''),
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      currency: String(amount.currency_code || '').toUpperCase(),
      feeAmount: Number.isFinite(parsedFee) ? parsedFee : 0,
      feeCurrency: String(fee.currency_code || amount.currency_code || '').toUpperCase(),
      transactionEventCode: String(info.transaction_event_code || ''),
      transactionSubject: String(info.transaction_subject || ''),
      transactionNote: String(info.transaction_note || ''),
      transactionInitiationDate: info.transaction_initiation_date || '',
      transactionUpdatedDate: info.transaction_updated_date || '',
    };
  }).filter((tx) => tx.id);
}
