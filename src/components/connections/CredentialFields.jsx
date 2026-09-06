import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Platform-specific integration credentials. These unlock the real API
// integrations users can activate themselves — Ko-fi live donation webhooks,
// and direct publishing to Bluesky (app password) and Mastodon (access token).
export default function CredentialFields({ platformId, credentials, onChange }) {
  const set = (k, v) => onChange({ ...credentials, [k]: v });

  if (platformId === "kofi") {
    return (
      <div className="space-y-1.5">
        <Label>Ko-fi verification token</Label>
        <Input value={credentials.kofi_verification_token || ""} onChange={(e) => set("kofi_verification_token", e.target.value)} placeholder="From Ko-fi → Settings → API/Webhooks" />
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
          <Input type="password" value={credentials.bluesky_app_password || ""} onChange={(e) => set("bluesky_app_password", e.target.value)} placeholder="From Bluesky → Settings → App Passwords" />
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
          <Input type="password" value={credentials.mastodon_access_token || ""} onChange={(e) => set("mastodon_access_token", e.target.value)} placeholder="From your instance → Development → New application" />
          <p className="text-xs text-stone-400">Enables direct publishing from the Distribution Engine. Stored privately on your account only.</p>
        </div>
      </>
    );
  }
  return null;
}