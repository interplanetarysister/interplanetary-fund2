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
export async function createOrder({ amount, description, customId }) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
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

export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const stableRequestId = stableProviderKey('IF_CAPTURE', orderId, 70);
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": stableRequestId,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `PayPal capture failed (${res.status})`);
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  const given = data.payer?.name?.given_name;
  const sur = data.payer?.name?.surname;
  const unit = data.purchase_units?.[0];
  return {
    status: data.status,
    amount: capture ? parseFloat(capture.amount?.value || "0") : 0,
    payer_name: given ? `${given} ${sur || ""}`.trim() : "",
    custom_id: unit?.custom_id || "",
    capture_id: capture?.id || "",
    currency: capture?.amount?.currency_code || unit?.amount?.currency_code || "",
  };
}
