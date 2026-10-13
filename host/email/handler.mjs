import { mailboxAllowed, sha256Hex, signPayload } from "./signature.mjs";

const MAX_MESSAGE_SIZE = 25 * 1024 * 1024;

function plainText(email) {
  const text = String(email.text || "").trim();
  if (text) return text;
  // IFund never renders HTML as HTML: retain the original in private R2.
  if (email.html) {
    return String(email.html)
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ||
      "[HTML-only email preserved in the private archive]";
  }
  return "[No readable text body — original email retained in private archive]";
}

// Dependency injection permits deterministic tests without public DNS, email,
// database, secrets, or a live Cloudflare worker.
export async function handleOfficialEmail(message, env, { parseEmail, post = fetch } = {}) {
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
      !env.IFUND_MAIL_INGEST_SHARED_SECRET || typeof parseEmail !== "function") {
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
  // Do not acknowledge incoming email before the durable archive write succeeds.
  await env.IFUND_MAIL_ARCHIVE.put(archiveKey, raw, {
    httpMetadata: { contentType: "message/rfc822" },
  });

  const email = await parseEmail(raw);
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
  const response = await post(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ifund-mail-timestamp": timestamp,
      "x-ifund-mail-signature": signature,
    },
    body,
    redirect: "error",
  });
  if (!response.ok) throw new Error(`IFund inbox ingress returned HTTP ${response.status}`);
  const result = await response.json().catch(() => null);
  if (result?.ok !== true) throw new Error("IFund inbox ingress did not confirm receipt");
}
