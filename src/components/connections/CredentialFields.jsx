import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Platform-specific integration credentials. Secret fields (Ko-fi token,
// Bluesky app password, Mastodon access token) are NEVER preloaded — the edit
// form receives them blanked with a credentials_meta "set" flag, so raw secrets
// never live in frontend state. The user types a new value to replace; leaving
// it blank preserves the stored value (merged server-side). Non-secret
// identifiers (handles, instances) load normally.
const SECRET_NOTE = "Currently set — enter a new value to replace it. Leave blank to keep the current one.";

export default function CredentialFields({ platformId, credentials, credentialsMeta, onChange }) {
  const set = (k, v) => onChange({ ...credentials, [k]: v });
  const isSet = (f) => !!(credentialsMeta && credentialsMeta[f + "_set"]);

  if (platformId === "kofi") {
    return (
      <div className="space-y-1.5">
        <Label>Ko-fi verification token</Label>
        <Input
          value={credentials.kofi_verification_token || ""}
          onChange={(e) => set("kofi_verification_token", e.target.value)}
          placeholder={isSet("kofi_verification_token") ? "Enter new token to replace" : "From Ko-fi → Settings → API/Webhooks"}
        />
        {isSet("kofi_verification_token") && <p className="text-xs text-emerald-600">{SECRET_NOTE}</p>}
        <p className="text-xs text-stone-400">
          Then set your Ko-fi webhook URL to <code className="bg-stone-100 px-1 rounded">{window.location.origin}/functions/kofiWebhook</code> — donations will sync live into your totals and inbox.
        </p>
      </div>
    );
  }
  if (platformId === "bluesky") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>Bluesky handle</Label>
          <Input value={credentials.bluesky_handle || ""} onChange={(e) => set("bluesky_handle", e.target.value)} placeholder="you.bsky.social" />
        </div>
        <div className="space-y-1.5">
          <Label>App password</Label>
          <Input
            type="password"
            value={credentials.bluesky_app_password || ""}
            onChange={(e) => set("bluesky_app_password", e.target.value)}
            placeholder={isSet("bluesky_app_password") ? "Enter new password to replace" : "From Bluesky → Settings → App Passwords"}
          />
          {isSet("bluesky_app_password") && <p className="text-xs text-emerald-600">{SECRET_NOTE}</p>}
          <p className="text-xs text-stone-400">Enables direct publishing from the Distribution Engine. Stored privately on your account only.</p>
        </div>
      </>
    );
  }
  if (platformId === "mastodon") {
    return (
      <>
        <div className="space-y-1.5">
          <Label>Instance</Label>
          <Input value={credentials.mastodon_instance || ""} onChange={(e) => set("mastodon_instance", e.target.value)} placeholder="mastodon.social" />
        </div>
        <div className="space-y-1.5">
          <Label>Access token</Label>
          <Input
            type="password"
            value={credentials.mastodon_access_token || ""}
            onChange={(e) => set("mastodon_access_token", e.target.value)}
            placeholder={isSet("mastodon_access_token") ? "Enter new token to replace" : "From your instance → Development → New application"}
          />
          {isSet("mastodon_access_token") && <p className="text-xs text-emerald-600">{SECRET_NOTE}</p>}
          <p className="text-xs text-stone-400">Enables direct publishing from the Distribution Engine. Stored privately on your account only.</p>
        </div>
      </>
    );
  }
  return null;
}