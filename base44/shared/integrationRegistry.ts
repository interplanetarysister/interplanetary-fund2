// Shared helpers for the Platform Access Registry. Reused by the health
// validator, the agent-access gatekeeper, and the admin management function.
// Never imports or handles secret values — only reference names and metadata.

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
    console.error("emitIntegrationAlert failed:", e && e.message ? e.message : e);
  }
}