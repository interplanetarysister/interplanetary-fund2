import PostalMime from "postal-mime";

const DOMAIN = "interplanetaryfund.com";
const DEFAULT_ADDRESSES = ["admin", "support", "donations", "legal", "hello"];
const MAX_EMAIL_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 100_000;
const makeJson = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const truncate = (value, size) => String(value || "").replace(/\0/g, "").slice(0, size);

function recipientAllowed(value, env) {
  const address = String(value || "").toLowerCase().trim();
  const parts = address.split("@");
  if (parts.length !== 2 || parts[1] !== DOMAIN) return false;
  const allowed = String(env.MAIL_LOCAL_PARTS || DEFAULT_ADDRESSES.join(","))
    .split(",").map(part => part.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(parts[0]);
}

function authorized(request, env) {
  const expected = String(env.MAIL_API_TOKEN || "");
  const supplied = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || expected.length < 32 || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function fingerprint(raw, recipient) {
  const to = new TextEncoder().encode(recipient);
  const bytes = new Uint8Array(raw.byteLength + to.byteLength);
  bytes.set(new Uint8Array(raw));
  bytes.set(to, raw.byteLength);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    b => b.toString(16).padStart(2, "0")).join("");
}

function textFrom(message) {
  if (typeof message.text === "string" && message.text.trim()) return truncate(message.text, MAX_TEXT);
  // HTML-only messages are intentionally NOT rendered as HTML in the IFund application.
  return truncate(String(message.html || "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">"), MAX_TEXT).trim();
}

async function receive(message, env) {
  const recipient = String(message.to || "").toLowerCase().trim();
  if (!recipientAllowed(recipient, env)) {
    message.setReject("Mailbox not found");
    return;
  }
  if (!env.MAIL_DB || !env.MAIL_RAW) throw new Error("Mailbox storage is not configured");
  if (message.rawSize > MAX_EMAIL_BYTES) {
    message.setReject("Message exceeds the 10 MB mailbox limit");
    return;
  }

  const raw = await new Response(message.raw).arrayBuffer();
  if (raw.byteLength > MAX_EMAIL_BYTES) {
    message.setReject("Message exceeds the 10 MB mailbox limit");
    return;
  }
  const parser = new PostalMime();
  const parsed = await parser.parse(raw);
  const id = await fingerprint(raw, recipient);
  const rawKey = `mail/${id}.eml`;
  const bodyText = textFrom(parsed);
  const received = new Date().toISOString();
  const sender = truncate(parsed.from?.address || message.from || "", 320);
  const subject = truncate(parsed.subject || "(No subject)", 300);

  // Save the complete original message privately, including any MIME attachments.
  // Never surface its HTML or attachment data into an untrusted public document.
  await env.MAIL_RAW.put(rawKey, raw, {
    httpMetadata: { contentType: "message/rfc822" },
  });
  try {
    await env.MAIL_DB.prepare(
      `INSERT OR IGNORE INTO mailbox_messages
       (id, recipient, sender, subject, preview, body_text, received_at, raw_key, raw_size, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(id, recipient, sender, subject, bodyText.slice(0, 240),
      bodyText, received, rawKey, raw.byteLength).run();
  } catch (error) {
    // Keep the R2 original if D1 fails. Mail retries are idempotent and can heal D1 later.
    throw error;
  }
}

async function api(request, env) {
  if (!authorized(request, env)) return makeJson({ error: "Unauthorized" }, 401);
  if (!env.MAIL_DB || !env.MAIL_RAW) return makeJson({ error: "Storage unavailable" }, 503);
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/messages") {
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const result = await env.MAIL_DB.prepare(
      `SELECT id, recipient, sender, subject, preview, received_at, is_read
       FROM mailbox_messages ORDER BY received_at DESC, id DESC LIMIT ?`
    ).bind(limit).all();
    return makeJson({ ok: true, messages: result.results || [] });
  }

  const match = /^\/api\/messages\/([a-f0-9]{64})(?:\/(read))?$/.exec(url.pathname);
  if (!match) return makeJson({ error: "Not found" }, 404);
  const id = match[1];
  if (request.method === "GET" && !match[2]) {
    const msg = await env.MAIL_DB.prepare(
      `SELECT id, recipient, sender, subject, body_text, received_at, is_read
       FROM mailbox_messages WHERE id = ?`
    ).bind(id).first();
    if (!msg) return makeJson({ error: "Not found" }, 404);
    return makeJson({ ok: true, message: msg });
  }
  if (request.method === "POST" && match[2] === "read") {
    const result = await env.MAIL_DB.prepare(
      "UPDATE mailbox_messages SET is_read = 1 WHERE id = ?"
    ).bind(id).run();
    if ((result.meta?.changes || 0) === 0) return makeJson({ error: "Not found" }, 404);
    return makeJson({ ok: true });
  }
  return makeJson({ error: "Method not allowed" }, 405);
}

export default {
  email: receive,
  fetch: api,
};
