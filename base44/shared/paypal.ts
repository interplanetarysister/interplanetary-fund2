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

export async function sendPayout({ receiver, amount, note, itemId }) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `IFW_${Date.now()}`,
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
    payout_batch_id: batchId,
    transaction_status: item?.transaction_status || "PENDING",
  };
}