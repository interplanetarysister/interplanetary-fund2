import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { AUTOMATION_MODES } from "./platformCatalog";
import CredentialFields from "./CredentialFields";

const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

// Social accounts are durable user-level connections: link once and the account
// is authorized for campaign broadcasts until the user disconnects it.
// Crowdfunding destinations may remain campaign-specific because their external
// fundraiser URL represents a particular fundraiser.
export default function ConnectDialog({ platform, existing, aiAuthorized, open, onOpenChange, onSaved }) {
  const isCrowd = platform.kind === "crowdfunding";
  const [form, setForm] = useState({ display_name: "", external_url: "", campaign_id: "", automation_mode: "auto", external_total: "", external_donor_count: "" });
  const [credentials, setCredentials] = useState({});
  const [campaigns, setCampaigns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      display_name: existing?.display_name || "",
      external_url: existing?.external_url || "",
      campaign_id: existing?.campaign_id || "",
      automation_mode: isCrowd ? (existing?.automation_mode || "manual") : "auto",
      external_total: existing?.external_total ?? "",
      external_donor_count: existing?.external_donor_count ?? "",
    });
    setCredentials(existing?.credentials || {});
    (async () => {
      try {
        const me = await base44.auth.me();
        setCampaigns(await base44.entities.Campaign.filter({ created_by_id: me.id }));
      } catch {
        setCampaigns([]);
      }
    })();
  }, [open, existing, isCrowd]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError("");
    const url = form.external_url.trim();
    const mode = isCrowd ? form.automation_mode : "auto";
    const externalTotal = Number(form.external_total || 0);
    const externalDonors = Number(form.external_donor_count || 0);

    if (!form.display_name.trim()) return setError("Please provide a name or handle for this connection.");
    if (!isValidUrl(url)) return setError("Please enter a valid HTTPS URL.");
    if (isCrowd && (!Number.isFinite(externalTotal) || externalTotal < 0 || !Number.isFinite(externalDonors) || externalDonors < 0)) {
      return setError("External totals and donor counts must be zero or greater.");
    }
    if (isCrowd && mode !== "manual" && !aiAuthorized) return setError("AI Publishing Authorization is required before enabling automation.");
    if (platform.id === "bluesky" && (!credentials.bluesky_handle || !credentials.bluesky_app_password)) return setError("Bluesky handle and app password are required for direct publishing.");
    if (platform.id === "mastodon" && (!credentials.mastodon_instance || !credentials.mastodon_access_token)) return setError("Mastodon instance and access token are required for direct publishing.");
    if (platform.id === "kofi" && !credentials.kofi_verification_token) return setError("Ko-fi verification token is required for live donation sync.");

    setSaving(true);
    const now = new Date().toISOString();
    try {
      // A social account is linked once and reused across campaigns. If the user
      // opens Connect again for the same platform, update the existing account
      // connection rather than creating a campaign-specific duplicate.
      let target = existing;
      if (!isCrowd && !target) {
        const all = await base44.entities.PlatformConnection.filter({});
        target = all.find((c) => c.platform === platform.id && c.kind === "social" && c.status !== "disconnected") || null;
      }

      const data = {
        platform: platform.id,
        kind: platform.kind,
        display_name: form.display_name.trim(),
        external_url: url,
        campaign_id: isCrowd ? (form.campaign_id || undefined) : undefined,
        automation_mode: mode,
        credentials,
        external_total: isCrowd ? externalTotal : 0,
        external_donor_count: isCrowd ? externalDonors : 0,
        status: "connected",
        last_synced: now,
        last_error: "",
        history: [
          ...(target?.history || []),
          {
            at: now,
            event: target ? "reconnected" : "connected",
            detail: isCrowd
              ? (target ? "Details and totals updated" : `Connected ${platform.name}`)
              : (target ? "Account refreshed; broadcast authorization remains active" : `Connected ${platform.name}; broadcast authorization granted`),
          },
        ].slice(-30),
      };

      const saved = target
        ? await base44.entities.PlatformConnection.update(target.id, data)
        : await base44.entities.PlatformConnection.create(data);
      onSaved(saved || { ...target, ...data });
      onOpenChange(false);
    } catch (e) {
      setError(e.message || "Couldn't save this connection. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-xl">{existing ? "Manage" : "Connect"} {platform.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-stone-500 -mt-2">{platform.api}</p>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>{isCrowd ? "Campaign name on that platform" : "Account name / handle"}</Label><Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder={isCrowd ? "e.g. Help Rebuild Our Shelter" : "e.g. @interplanetaryfund"} /></div>
          <div className="space-y-1.5"><Label>{isCrowd ? "External campaign URL" : "Profile URL"}</Label><Input value={form.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://…" /></div>
          <CredentialFields platformId={platform.id} credentials={credentials} onChange={setCredentials} />

          {isCrowd ? (
            <div className="space-y-1.5"><Label>Linked Interplanetary Fund campaign</Label><Select value={form.campaign_id} onValueChange={(v) => set("campaign_id", v)}><SelectTrigger><SelectValue placeholder="Optional — pick a campaign" /></SelectTrigger><SelectContent>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent></Select></div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-stone-700"><p className="font-semibold text-stone-900">One-time account authorization</p><p className="mt-1 text-xs text-stone-500">Linking this account authorizes Interplanetary Fund to use it for your campaign broadcasts. You will not be asked to approve every post. Disconnect the account to revoke this authorization.</p></div>
          )}

          {isCrowd && <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Raised there ($)</Label><Input type="number" min="0" value={form.external_total} onChange={(e) => set("external_total", e.target.value)} placeholder="0" /></div><div className="space-y-1.5"><Label>Donors there</Label><Input type="number" min="0" value={form.external_donor_count} onChange={(e) => set("external_donor_count", e.target.value)} placeholder="0" /></div></div>}

          {isCrowd && <div className="space-y-1.5"><Label>AI automation for this destination</Label><Select value={form.automation_mode} onValueChange={(v) => set("automation_mode", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual posting</SelectItem><SelectItem value="draft">Draft only</SelectItem></SelectContent></Select><p className="text-xs text-stone-400">Crowdfunding pages without a publishing API are prepared for you to copy and post. Linking still authorizes Interplanetary Fund to prepare updates without asking for each post.</p></div>}

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : existing ? "Save changes" : isCrowd ? "Connect" : "Connect & authorize broadcasts"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
