import PostalMime from "postal-mime";
import { mailboxAllowed, sha256Hex, signPayload } from "./signature.mjs";

// Dedicated email Worker: intentionally separate from IFund's live HTTP gateway.
// The private R2 archive is written before any downstream delivery attempt.
const MAX_MESSAGE_SIZE = 25 * 1024 * 1024;

function plainText(email) {
  const text = String(email.text || "").trim();
  if (text) return text;
  // HTML is never rendered inside IFund. Preserve original RFC822 in private R2.
  if (email.html) {
    return String(email.html)
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ||
      "[HTML-only email preserved in the private archive]";
  }
  return "[No readable text body — original email retained in private archive]";
}

export default {
  async email(message, env) {
    const to = String(message.to || "").trim().toLowerCase();
    if (!mailboxAllowed(to, env.IFUND_MAIL_ALLOWED_ADDRESSES)) {
      message.setReject("This mailbox does not accept email");
      return;
    }
    if (!Number.isFinite(message.rawSize) || message.rawSize > MAX_MESSAGE_SIZE) {
      message.setReject("Message exceeds the allowed size");
      return;
    }
    if (!env.IFUND_MAIL_ARCHIVE || !env.IFUND_MAIL_INGEST_ENDPOINT ||
        !env.IFUND_MAIL_INGEST_SHARED_SECRET) {
      // Do not acknowledge or discard mail when a required service is absent.
      throw new Error("Official email receiver is not fully configured");
    }
    const url = new URL(env.IFUND_MAIL_INGEST_ENDPOINT);
    if (url.protocol !== "https:") throw new Error("Email ingest endpoint must use HTTPS");

    const raw = await new Response(message.raw).arrayBuffer();
    if (raw.byteLength > MAX_MESSAGE_SIZE) {
      message.setReject("Message exceeds the allowed size");
      return;
    }
    const messageHash = await sha256Hex(raw);
    const mailboxHash = await sha256Hex(new TextEncoder().encode(to));
    const archiveKey = `received/${mailboxHash}/${messageHash}.eml`;
    await env.IFUND_MAIL_ARCHIVE.put(archiveKey, raw, {
      httpMetadata: { contentType: "message/rfc822" },
    });

    const email = await PostalMime.parse(raw);
    const body = JSON.stringify({
      id: messageHash,
      from: String(message.from || "").slice(0, 320),
      to,
      subject: String(email.subject || message.headers?.get("subject") || "").slice(0, 240),
      text: plainText(email).slice(0, 12000),
      attachment_count: Array.isArray(email.attachments) ? email.attachments.length : 0,
      archive_key: archiveKey,
      received_at: new Date().toISOString(),
    });
    const timestamp = String(Date.now());
    const signature = await signPayload(body, timestamp, env.IFUND_MAIL_INGEST_SHARED_SECRET);
    // The response must confirm a durable IFund inbox write. Never swallow failures.
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ifund-mail-timestamp": timestamp,
        "x-ifund-mail-signature": signature,
      },
      body,
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(`IFund inbox ingress returned HTTP ${response.status}`);
    }
    const result = await response.json().catch(() => null);
    if (result?.ok !== true) throw new Error("IFund inbox ingress did not confirm receipt");
  },
};
