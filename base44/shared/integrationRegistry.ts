// Shared helpers for the Platform Access Registry. Reused by the health
// validator, the agent-access gatekeeper, and the admin management function.
// Never imports or handles secret values — only reference names and metadata.

const DIAGNOSTIC_TYPES = new Set(["error", "string", "object", "nullish", "primitive"]);

export function classifyDiagnostic(value) {
  if (value == null) return "nullish";
  const kind = typeof value;
  if (kind === "string") return "string";
  if (kind === "object" || kind === "function") return "object";
  if (kind === "number" || kind === "boolean" || kind === "bigint" || kind === "symbol") return "primitive";
  return DIAGNOSTIC_TYPES.has(kind) ? kind : "object";
}

// Emit a deduplicated admin alert for an unhealthy integration. Skips creating
// a new Notification when an unread integration alert for the same platform
// already exists for an admin, so a persistent condition isn't re-alerted.
export async function emitIntegrationAlert(sr, entry, title, body) {
  try {
    const admins = await sr.entities.User.filter({ role: "admin" }).catch(() => []);
    for (const admin of admins) {
      const open = await sr.entities.Notification.filter({ user_id: admin.id, read: false }).catch(() => []);
      const dupe = open.some(
        (n) => n.type === "system" && (n.link || "") === "/admin/integrations" && (n.title || "").includes(`[${entry.platform}]`)
      );
      if (dupe) continue;
      await sr.entities.Notification.create({
        user_id: admin.id,
        title,
        body,
        type: "system",
        link: "/admin/integrations",
      });
    }
  } catch (e) {
    console.error("emitIntegrationAlert failed", { type: classifyDiagnostic(e) });
  }
}

// Credential fields that are actual secrets (never returned to the frontend,
// never logged). Non-secret identifiers (handles, instances) stay visible.
export const SECRET_FIELDS = [
  "kofi_verification_token",
  "bluesky_app_password",
  "mastodon_access_token",
];

export const STATUS_LABEL = {
  ACTIVE: "Active",
  REAUTH_REQUIRED: "Reauthorization required",
  EXPIRES_SOON: "Expires soon",
  DISCONNECTED: "Disconnected",
  REVOKED: "Revoked",
  MISCONFIGURED: "Misconfigured",
};

export const STATUS_BADGE = {
  ACTIVE: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  REAUTH_REQUIRED: { label: "Reauth required", className: "bg-amber-100 text-amber-700" },
  EXPIRES_SOON: { label: "Expires soon", className: "bg-amber-100 text-amber-700" },
  DISCONNECTED: { label: "Disconnected", className: "bg-stone-200 text-stone-600" },
  REVOKED: { label: "Revoked", className: "bg-red-100 text-red-700" },
  MISCONFIGURED: { label: "Misconfigured", className: "bg-red-100 text-red-700" },
};

export const AUTH_TYPE_LABEL = {
  oauth: "OAuth",
  api_key: "API key",
  webhook_secret: "Webhook secret",
  env_config: "Env / platform config",
  per_connection: "Per-connection",
  none: "None",
};

export const ENV_LABEL = { production: "Production", development: "Development", sandbox: "Sandbox" };

export const UNHEALTHY = new Set(["REAUTH_REQUIRED", "EXPIRES_SOON", "DISCONNECTED", "REVOKED", "MISCONFIGURED"]);

export function isUnhealthy(status) {
  return UNHEALTHY.has(status);
}

// Strip secret values from a credentials object and report which secrets are
// set, so the UI can show "set — enter new to replace" without ever holding
// the raw value in frontend state.
export function redactCredentials(creds) {
  const c = creds || {};
  const meta = {};
  for (const f of SECRET_FIELDS) meta[f + "_set"] = !!c[f];
  const redacted = { ...c };
  for (const f of SECRET_FIELDS) if (redacted[f]) redacted[f] = "";
  return { credentials: redacted, credentials_meta: meta };
}

export function mergeSecrets(existingCreds, incomingCreds) {
  const merged = { ...(existingCreds || {}) };
  const incoming = incomingCreds || {};
  for (const f of SECRET_FIELDS) {
    if (incoming[f]) merged[f] = incoming[f];
  }
  for (const k of Object.keys(incoming)) {
    if (!SECRET_FIELDS.includes(k)) merged[k] = incoming[k];
  }
  return merged;
}

export async function assertPlatformAccess(sr, platform) {
  let entries;
  try {
    entries = await sr.entities.PlatformAccessRegistry.filter({ platform });
  } catch (e) {
    console.warn("assertPlatformAccess registry read failed", { type: classifyDiagnostic(e) });
    return { ok: true, status: null, reason: "registry unavailable (fail-open)" };
  }
  const entry = entries && entries[0];
  if (!entry) return { ok: false, status: null, reason: `no registry entry for ${platform}` };
  const ok = entry.status === "ACTIVE" || entry.status === "EXPIRES_SOON";
  return { ok, status: entry.status, reason: ok ? "ok" : `status ${entry.status}` };
}

export function resolveConvex(raw) {
  const r = String(raw || "").trim();
  if (!r) return { url: null, token: null };
  let token = null;
  let u = r;
  if (u.includes("|")) { const parts = u.split("|"); u = parts[0]; token = parts[1] || null; }
  if (/^(dev|prod):/i.test(u)) u = u.replace(/^(dev|prod):/i, "");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const host = u.replace(/^https?:\/\//i, "").split("/")[0];
  if (host && !host.includes(".")) u = `https://${host}.convex.cloud`;
  if (!/\.convex\.cloud/i.test(u)) return { url: null, token: null };
  if (!/\/api\/query$/.test(u)) u = `${u.replace(/\/$/, "")}/api/query`;
  return { url: u, token };
}

export async function assertOboGrant(sr, agentName, userId, platform) {
  let grants;
  try {
    grants = await sr.entities.AuthorizationGrant.filter({ agent_name: agentName, user_id: userId, platform });
  } catch (e) {
    console.warn("assertOboGrant read failed", { type: classifyDiagnostic(e) });
    return { ok: false, reason: "grant registry unavailable" };
  }
  const now = Date.now();
  const active = (grants || []).find((g) => {
    if ((g.status || "active") === "revoked") return false;
    if (g.expires_at && new Date(g.expires_at).getTime() < now) return false;
    return (g.status || "active") === "active";
  });
  if (!active) return { ok: false, reason: `no active OBO grant for agent=${agentName} user=${userId} platform=${platform}` };
  return { ok: true, grant: active };
}
