// Shared Cloudflare Worker helpers; never store secret values in source control.
export function mailboxAllowed(address, configuredAddresses) {
  const normalized = String(address || "").trim().toLowerCase();
  const allowed = String(configuredAddresses || "")
    .split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
  return normalized.endsWith("@interplanetaryfund.com") &&
    normalized.indexOf("@") === normalized.lastIndexOf("@") &&
    allowed.includes(normalized);
}

export async function sha256Hex(data) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signPayload(body, timestamp, secret) {
  if (!secret || secret.length < 32) throw new Error("Inbound email signing secret is missing or too short");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const payload = new TextEncoder().encode(`${timestamp}.${body}`);
  const signature = await crypto.subtle.sign("HMAC", key, payload);
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
