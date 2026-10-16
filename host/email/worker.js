import PostalMime from "postal-mime";

// Separate Cloudflare Email Worker. No public mailbox endpoints or frontend access.
// Install IFUND_EMAIL_INGRESS_SECRET, IFUND_EMAIL_RECEIVER_URL and
// IFUND_EMAIL_ALLOWED_RECIPIENTS as Worker secrets before enabling email routes.
const encoder = new TextEncoder();
const hex = (data) => [...new Uint8Array(data)].map(v => v.toString(16).padStart(2, "0")).join("");
const trim = (value, limit) => String(value || "").slice(0, limit);

async function sign(secret, timestamp, payload) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(timestamp + "." + payload)));
}

export default {
  async email(message, env) {
    const secret = String(env.IFUND_EMAIL_INGRESS_SECRET || "");
    const endpoint = String(env.IFUND_EMAIL_RECEIVER_URL || "");
    const allowed = String(env.IFUND_EMAIL_ALLOWED_RECIPIENTS || "")
      .toLowerCase().split(",").map(value => value.trim()).filter(Boolean);
    const destination = String(message.to || "").toLowerCase();
    // Configuration errors fail closed; do not accept and silently discard mail.
    if (secret.length < 32 || !endpoint.startsWith("https://") || allowed.length === 0) {
      message.setReject("Mailbox unavailable");
      return;
    }
    if (!allowed.includes(destination) || !destination.endsWith("@interplanetaryfund.com")) {
      message.setReject("Unknown mailbox");
      return;
    }
    if (Number(message.rawSize || 0) > 2_000_000) {
      message.setReject("Email too large");
      return;
    }
    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    if (raw.byteLength > 2_000_000) {
      message.setReject("Email too large");
      return;
    }
    const parsed = await PostalMime.parse(raw);
    const fallbackId = hex(await crypto.subtle.digest("SHA-256", raw));
    const messageId = trim(message.headers?.get("message-id") || fallbackId, 254);
    const body = JSON.stringify({
      message_id: messageId,
      from: trim(message.from, 254),
      to: destination,
      subject: trim(parsed.subject, 240),
      text: trim(parsed.text, 12000),
    });
    const stamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(secret, stamp, body);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ifund-email-timestamp": stamp,
        "x-ifund-email-signature": signature,
      },
      body,
      redirect: "error",
    });
    // Preserve failure visibility. Never report delivery success without
    // a successful authenticated Base44 write.
    if (!response.ok) throw new Error("IFund inbox receiver returned HTTP " + response.status);
  },
};
