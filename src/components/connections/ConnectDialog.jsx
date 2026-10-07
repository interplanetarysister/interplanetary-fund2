import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import CredentialFields from "./CredentialFields";

// Connect (or edit) one destination. Crowdfunding connections link an external
// campaign page and its totals; social connections link an account and set the
// AI automation permission for that destination.
export default function ConnectDialog({ platform, existing, aiAuthorized, managedAvailable = false, onManagedCreateAccount, open, onOpenChange, onSaved }) {
  const isCrowd = platform.kind === "crowdfunding";
  const usesProviderOAuth = platform.setupKind === "oauth";
  const canUseUnifiedProviderFlow = usesProviderOAuth;
  const [form, setForm] = useState({ display_name: "", external_url: "", campaign_id: "", automation_mode: "manual", external_total: "", external_currency: "USD", external_donor_count: "" });
  const [credentials, setCredentials] = useState({});
  const [campaigns, setCampaigns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [managedBusy, setManagedBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      display_name: existing?.display_name || "",
      external_url: existing?.external_url || "",
      campaign_id: existing?.campaign_id || "",
      automation_mode: existing?.automation_mode || (aiAuthorized ? "auto" : "manual"),
      external_total: existing?.external_total ?? "",
      external_currency: existing ? (existing.external_currency || "") : "USD",
      external_donor_count: existing?.external_donor_count ?? "",
    });
    setCredentials(existing?.credentials || {});
    base44.auth.me()
      .then((me) => base44.entities.Campaign.filter({ created_by_id: me.id }))
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, [open, existing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const connectWithProvider = async () => {
    setConnecting(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("getAppUserConnector", { platform: platform.id });
      if (!data?.supported) {
        setError("This platform can’t be connected this way yet.");
        return;
      }
      if (!data?.configured || !data?.connector_id) {
        setError("This connection is not ready yet. Please try again later.");
        return;
      }
      // The IF consent and provider grant are one continuous connection event.
      // Persist only non-secret resume context; the connector owns OAuth state
      // and credentials. Provider authorization starts immediately after consent.
      const me = await base44.auth.me();
      const redirectUrl = await base44.connectors.connectAppUser(data.connector_id);
      if (!redirectUrl) throw new Error("Provider did not return a sign-in URL.");
      // localStorage survives a provider redirect that returns in another web tab.
      // Only the same signed-in owner can resume; no provider tokens are stored here.
      localStorage.setItem("ifund_pending_platform_connection", JSON.stringify({
        platform: platform.id, userId: me.id, startedAt: Date.now(),
      }));
      window.location.assign(redirectUrl);
    } catch (e) {
      console.error("Provider OAuth start failed:", e);
      setError("We couldn’t open sign-in. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const requestManagedAccountSetup = async () => {
    if (!onManagedCreateAccount || managedBusy) return;
    setManagedBusy(true);
    setError("");
    try {
      await onManagedCreateAccount({ campaign_id: form.campaign_id || undefined });
    } catch {
      setError("IFund couldn't start managed account setup. Try again.");
    } finally {
      setManagedBusy(false);
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
        <p className="text-xs text-muted-foreground -mt-2">{existing?.status === "connected" && existing?.verification_status === "verified" ? "On" : existing ? "Needs attention" : "Off"} · {usesProviderOAuth ? "Sign in on the platform to connect it." : "Add your link and follow the steps shown."}</p>
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
              <p className="text-xs text-stone-500">Enter the numbers shown on the other fundraiser. We’ll label them as confirmed only after we can check them.</p>
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
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">AI help: {aiAuthorized ? "On" : "Off"}</p>
            <p className="text-xs text-muted-foreground mt-1">{aiAuthorized ? "AI authorization includes OBO access for every platform you connect. Provider sign-in and supported capabilities still determine what can be performed." : "Turn on AI help on the Connections page if you want Interplanetary Fund to act on your behalf through connected platforms."}</p>
          </div>
          {usesProviderOAuth && !existing && (
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1">
              <p className="text-sm font-semibold text-foreground">Connect {platform.name}</p>
              <p className="text-xs text-muted-foreground">Your existing IFund AI authorization already includes OBO access for platforms you connect. {platform.name} will separately show the provider permissions it supports during sign-in.</p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {usesProviderOAuth && (!existing || existing?.capability_status === "reauthorization_required") ? (
            <Button onClick={connectWithProvider} disabled={connecting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : existing ? `Reconnect ${platform.name}` : `Connect ${platform.name}`}
            </Button>
          ) : (
            <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : existing ? "Save changes" : "Connect"}
            </Button>
          )}
          {!existing && managedAvailable && onManagedCreateAccount && platform.kind !== "app" && (
            <Button type="button" variant="outline" onClick={requestManagedAccountSetup} disabled={managedBusy} className="w-full rounded-xl h-11">
              {managedBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask IFund to help set up a new account"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
