import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";
import { AUTOMATION_MODES } from "./platformCatalog";
import CredentialFields from "./CredentialFields";

// Connect (or edit) one destination. Crowdfunding connections link an external
// campaign page and its totals; social connections link an account and set the
// AI automation permission for that destination.
export default function ConnectDialog({ platform, existing, aiAuthorized, open, onOpenChange, onSaved }) {
  const isCrowd = platform.kind === "crowdfunding";
  const usesProviderOAuth = !isCrowd && ["linkedin", "facebook", "instagram", "discord", "tiktok"].includes(platform.id);
  const [form, setForm] = useState({ display_name: "", external_url: "", campaign_id: "", automation_mode: "manual", external_total: "", external_currency: "USD", external_donor_count: "" });
  const [credentials, setCredentials] = useState({});
  const [campaigns, setCampaigns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [permissionAccepted, setPermissionAccepted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      display_name: existing?.display_name || "",
      external_url: existing?.external_url || "",
      campaign_id: existing?.campaign_id || "",
      automation_mode: existing?.automation_mode || "manual",
      external_total: existing?.external_total ?? "",
      external_currency: existing ? (existing.external_currency || "") : "USD",
      external_donor_count: existing?.external_donor_count ?? "",
    });
    setCredentials(existing?.credentials || {});
    setPermissionAccepted(!!existing);
    (async () => {
      const me = await base44.auth.me();
      setCampaigns(await base44.entities.Campaign.filter({ created_by_id: me.id }));
    })();
  }, [open, existing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const permissionItems = usesProviderOAuth ? [
    "See the connected account and campaign-related information",
    "Create or update campaign posts when the provider allows it",
    "Read and respond to campaign interactions when supported",
    "Use the same authorized connection across your Interplanetary Fund agent team",
  ] : [];

  const connectWithProvider = async () => {
    setConnecting(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("getAppUserConnector", { platform: platform.id });
      if (!data?.configured || !data?.connector_id) {
        setError("Secure provider sign-in is not configured for this platform yet.");
        return;
      }
      sessionStorage.setItem("ifund_pending_oauth_platform", platform.id);
      sessionStorage.setItem("ifund_pending_oauth_shared_agent_consent", permissionAccepted ? "true" : "false");
      const redirectUrl = await base44.connectors.connectAppUser(data.connector_id);
      window.location.href = redirectUrl;
    } catch (e) {
      console.error("Provider OAuth start failed:", e);
      setError("Couldn't open the provider sign-in. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      // Route through the credential-merge function so secret values never
      // round-trip through the frontend and merges preserve unchanged secrets.
      const res = await base44.functions.invoke("saveConnectionCredentials", {
        connection_id: existing?.id,
        platform: platform.id,
        kind: platform.kind,
        display_name: form.display_name,
        external_url: form.external_url,
        campaign_id: form.campaign_id || undefined,
        automation_mode: form.automation_mode,
        external_total: isCrowd ? Number(form.external_total) || 0 : 0,
        external_currency: isCrowd ? form.external_currency.trim().toUpperCase() : undefined,
        external_donor_count: isCrowd ? Number(form.external_donor_count) || 0 : 0,
        credentials,
      });
      const saved = res.data.connection;
      onSaved(saved || { ...existing, display_name: form.display_name, external_url: form.external_url });
      onOpenChange(false);
    } catch (e) {
      console.error("ConnectDialog connection save failed:", e);
      setError("Couldn't save this connection. Please try again. If the problem continues, contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{existing ? "Manage" : "Connect"} {platform.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-stone-500 -mt-2">{existing ? "On" : "Off"} · {usesProviderOAuth ? "Sign in with the provider. Interplanetary Fund never asks you to paste OAuth tokens." : "Interplanetary Fund will handle the connection method for you."}</p>
        <div className="space-y-4">
          {!usesProviderOAuth && <div className="space-y-1.5">
            <Label>{isCrowd ? "Campaign name on that platform" : "Account name / handle"}</Label>
            <Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder={isCrowd ? "e.g. Help Rebuild Our Shelter" : "e.g. @interplanetaryfund"} />
          </div>}
          {!usesProviderOAuth && <div className="space-y-1.5">
            <Label>{isCrowd ? "External campaign URL" : "Profile URL"}</Label>
            <Input value={form.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://…" />
          </div>}
          {!usesProviderOAuth && <CredentialFields platformId={platform.id} credentials={credentials} credentialsMeta={existing?.credentials_meta || {}} onChange={setCredentials} />}
          <div className="space-y-1.5">
            <Label>Linked Interplanetary Fund campaign</Label>
            <Select value={form.campaign_id} onValueChange={(v) => set("campaign_id", v)}>
              <SelectTrigger><SelectValue placeholder="Optional — pick a campaign" /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isCrowd && (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">Enter owner-reported external figures. They remain informational until the provider verifies them.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Reported total</Label>
                  <Input type="number" min="0" step="0.01" value={form.external_total} onChange={(e) => set("external_total", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input value={form.external_currency} maxLength={3} onChange={(e) => set("external_currency", e.target.value.toUpperCase())} placeholder="USD" />
                </div>
                <div className="space-y-1.5">
                  <Label>Reported donors</Label>
                  <Input type="number" min="0" step="1" value={form.external_donor_count} onChange={(e) => set("external_donor_count", e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>AI automation for this destination</Label>
            <Select value={form.automation_mode} onValueChange={(v) => set("automation_mode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTOMATION_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value} disabled={m.value !== "manual" && !aiAuthorized}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-stone-400">
              {aiAuthorized
                ? AUTOMATION_MODES.find((m) => m.value === form.automation_mode)?.desc
                : "Accept the AI Publishing Authorization above to enable automation options."}
            </p>
          </div>
          {usesProviderOAuth && !existing && (
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
              <p className="text-sm font-semibold text-foreground">Allow Interplanetary Fund to help with this connection?</p>
              <p className="text-xs text-muted-foreground">We’ll ask {platform.name} for the useful campaign permissions it supports. {platform.name} decides what is actually available.</p>
              <div className="space-y-1.5">
                {permissionItems.map((item) => <p key={item} className="flex gap-2 text-xs text-foreground"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />{item}</p>)}
              </div>
              <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                <input type="checkbox" checked={permissionAccepted} onChange={(e) => setPermissionAccepted(e.target.checked)} className="mt-0.5" />
                <span>I allow this connection to be shared with my Interplanetary Fund agents for these supported campaign actions.</span>
              </label>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {usesProviderOAuth && !existing ? (
            <Button onClick={connectWithProvider} disabled={connecting || !permissionAccepted} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Allow & connect ${platform.name}`}
            </Button>
          ) : (
            <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : existing ? "Save changes" : "Connect"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}