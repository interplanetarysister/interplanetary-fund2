import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { KeyRound, ShieldCheck, ExternalLink } from "lucide-react";

// Fetch Credentials / API Info — a secure, subscription-only guided helper.
// When a platform requires connection information, this offers to help the
// user retrieve permitted API/config info from the provider's official
// developer console using their own authorized browser session (we open the
// provider's official page; we never automate, scrape, or bypass MFA/CAPTCHA or
// security controls). Requires explicit user permission before starting.
// Secrets are never exposed in client code, logs, or agent-visible text — only
// stored through the existing approved secret-storage/reference system. The
// manual credential-entry option always remains available.
export default function FetchCredentialsDialog({ platform, open, onOpenChange, onUseManual }) {
  const [permission, setPermission] = useState(false);

  // Official provider credential/console pages — real links, opened in the
  // user's own browser. We do not fetch, parse, or store anything here.
  const consoleUrl = {
    kofi: "https://ko-fi.com/account/webhooks",
    buymeacoffee: "https://developers.buymeacoffee.com/",
    patreon: "https://www.patreon.com/portal/registration/register-clients",
    bluesky: "https://bsky.app/settings/app-passwords",
    mastodon: "https://docs.joinmastodon.org/api/",
    stripe: "https://dashboard.stripe.com/apikeys",
    paypal: "https://developer.paypal.com/dashboard/applications/live",
  }[platform?.id] || "https://developers.google.com/";

  const start = () => {
    if (!permission) return;
    window.open(consoleUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
    setPermission(false);
    onUseManual?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPermission(false); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Fetch Credentials / API Info</DialogTitle>
          <DialogDescription>
            We can open {platform?.name || "the provider"}'s official developer page in your own browser so you can copy the permitted API or configuration info yourself. We never bypass MFA, CAPTCHA, or any provider security control, and we never see or store your password or secret — you paste it into the secure field here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3">
          <div className="min-w-0">
            <Label htmlFor="perm" className="text-sm text-stone-700 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> I allow Interplanetary Fund to open the provider page</Label>
            <p className="text-xs text-stone-500 mt-0.5">Permission is required before we start. You can decline and enter credentials manually.</p>
          </div>
          <Switch id="perm" checked={permission} onCheckedChange={setPermission} />
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={start} disabled={!permission} className="w-full rounded-xl">
            <ExternalLink className="w-4 h-4 mr-2" /> Open {platform?.name || "provider"} page
          </Button>
          <Button variant="outline" onClick={() => { onOpenChange(false); onUseManual?.(); }} className="w-full rounded-xl">
            Enter credentials manually
          </Button>
          <p className="text-xs text-stone-400 text-center">OK. When you get the required credentials, enter them here.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}