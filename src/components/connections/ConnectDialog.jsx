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
      .then((rows) => setCampaigns((rows || []).filter((campaign) => campaign.status === "active" || campaign.id === existing?.campaign_id)))
      .catch(() => setCampaigns([]));
  }, [open, existing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const selectedCampaign = campaigns.find((campaign) => campaign.id === form.campaign_id) || null;
  const selectCampaign = (campaignId) => {
    const selected = campaigns.find((campaign) => campaign.id === campaignId);
    setForm((current) => ({
      ...current,
      campaign_id: campaignId,
      // Pairing a campaign also names the connection after that campaign so the
      // user never has to type the same title twice.
      display_name: selected?.title || current.display_name || "",
    }));
  };

  const connectWithProvider = async () => {
    if (connecting) return;
    setConnecting(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("getAppUserConnector", { platform: platform.id });
      if (!data?.supported) {
        setError("This platform does not offer verified provider sign-in through IFund yet.");
        return;
      }
      if (!data?.configured || !data?.connector_id) {
        setError(platform.id === "facebook"
          ? "Facebook Pages publishing has not been configured for IFund yet. Facebook sign-in does not grant posting permission."
          : "This platform connection requires provider setup before sign-in can open.");
        return;
      }
      const me = await base44.auth.me();
      if (!me?.id) throw new Error("Sign in to IFund first.");
      // Persist the resume hint BEFORE asking the SDK for an authorization URL:
      // an SDK may immediately navigate away. Never store codes or tokens here.
      localStorage.setItem("ifund_pending_platform_connection", JSON.stringify({
        platform: platform.id, userId: me.id, startedAt: Date.now(),
        step: "oauth_pending",
        campaignId: form.campaign_id || "",
        campaignTitle: selectedCampaign?.title || form.display_name || "",
        displayName: selectedCampaign?.title || form.display_name || "",
        publishInitial: platform.kind !== "app" && !!form.campaign_id,
        returnPath: "/connections",
      }));
      // A single-tab flow preserves the IFund origin/session on mobile and
      // avoids popup callbacks landing in an unrelated Base44 editor window.
      if (platform.kind !== "app" && !form.campaign_id) throw new Error("Choose a campaign before connecting this platform.");
      const redirectUrl = await base44.connectors.connectAppUser(data.connector_id);
      if (!redirectUrl) throw new Error("Provider did not return a sign-in URL.");
      const destination = new URL(String(redirectUrl));
      if (destination.protocol !== "https:" || destination.username || destination.password) {
        throw new Error("Provider sign-in URL is not secure.");
      }
      window.location.assign(destination.href);
    } catch (e) {
      localStorage.removeItem("ifund_pending_platform_connection");
      console.error("Provider OAuth start failed:", e?.name || "ProviderConnectionError");
      setError("The provider connection could not start. Try Connect again for a fresh authorization link.");
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
            <Label>{platform.kind === "app" ? "Linked Interplanetary Fund campaign" : "Campaign to publish first"}</Label>
            <Select value={form.campaign_id} onValueChange={selectCampaign}>
              <SelectTrigger><SelectValue placeholder={platform.kind === "app" ? "Optional — pick a campaign" : "Pick the campaign to publish first"} /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {platform.kind !== "app" && selectedCampaign && (
            <div className="space-y-1.5">
              <Label>Connection title</Label>
              <Input value={form.display_name} readOnly aria-readonly="true" />
              <p className="text-xs text-muted-foreground">This title follows the paired Interplanetary Fund campaign automatically.</p>
            </div>
          )}
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
              <p className="text-xs text-muted-foreground">Choose the Interplanetary Fund campaign first, then use the one-click link below. You’ll sign in on {platform.name}, approve the provider permissions, and return here automatically. Your existing IFund AI authorization applies without a second permission screen.</p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {usesProviderOAuth ? (
            <Button onClick={connectWithProvider} disabled={connecting || (platform.kind !== "app" && !selectedCampaign)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedCampaign && platform.kind !== "app" ? `Link ${selectedCampaign.title} to ${platform.name}` : existing ? `Reconnect ${platform.name}` : `Connect ${platform.name}`}
            </Button>
          ) : (
            <Button onClick={save} disabled={saving || (platform.kind !== "app" && !selectedCampaign)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedCampaign && platform.kind !== "app" ? `Link ${selectedCampaign.title} to ${platform.name}` : existing ? "Save changes" : "Connect"}
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
