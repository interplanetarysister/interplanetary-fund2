import { secrets } from "base44:runtime";

// Shared PayPal Payouts helper. All platform money moves in and out of the
// single PayPal business account configured via PAYPAL_CLIENT_ID / SECRET.
// Sandbox by default; set PAYPAL_MODE=live for real payouts.

function apiBase() {
  return secrets.get("PAYPAL_MODE") === "live"
    ? "https://api.paypal.com"
    : "https://api.sandbox.paypal.com";
}

async function getAccessToken() {
  const id = secrets.get("PAYPAL_CLIENT_ID");
  const secret = secrets.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) {
    throw new Error("PayPal credentials are not configured.");
  }
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${id}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function getPayoutBatch(payoutBatchId) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v1/payments/payouts/${encodeURIComponent(payoutBatchId)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `PayPal payout lookup failed (${res.status})`);
  }
  return {
    payout_batch_id: data.batch_header?.payout_batch_id || payoutBatchId,
    batch_status: data.batch_header?.batch_status || "UNKNOWN",
    items: Array.isArray(data.items) ? data.items : [],
  };
}

export async function sendPayout({ receiver, amount, note, itemId }) {
  const token = await getAccessToken();
  const senderBatchId = String(itemId || "").startsWith("IFW_")
    ? String(itemId)
    : `IFW_${String(itemId || crypto.randomUUID())}`;
  const res = await fetch(`${apiBase()}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
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
          sender_item_id: itemId,
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.error_description || `PayPal payout failed (${res.status})`;
    throw new Error(msg);
  }
  const batchId = data.batch_header?.payout_batch_id;
  const item = data.items?.[0];
  return {
    payout_batch_id: batchId || senderBatchId,
    transaction_status: item?.transaction_status || "PENDING",
  };
}

// Google Pay donations flow through the same PayPal business account as a
// standard PayPal v2 order: create an order on approval, capture it once the
// Google Pay payment data is confirmed.
export async function createOrder({ amount, description, metadata }) {
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
          ...(metadata?.campaign_id ? { custom_id: metadata.campaign_id } : {}),
        },
      ],
      application_context: { shipping_preference: "NO_SHIPPING" },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `PayPal order create failed (${res.status})`);
  }
  return { id: data.id };
}

export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `PayPal capture failed (${res.status})`);
  }
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  const given = data.payer?.name?.given_name;
  const sur = data.payer?.name?.surname;
  return {
    status: data.status,
    amount: capture ? parseFloat(capture.amount?.value || "0") : 0,
    payer_name: given ? `${given} ${sur || ""}`.trim() : "",
  };
}