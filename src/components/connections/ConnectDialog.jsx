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
export default function ConnectDialog({ platform, existing, aiAuthorized, managedAvailable = false, onManagedCreateAccount, onManagedConnect, open, onOpenChange, onSaved }) {
  const isCrowd = platform.kind === "crowdfunding";
  const usesProviderOAuth = platform.setupKind === "oauth";
  const canUseUnifiedProviderFlow = usesProviderOAuth;
  const [form, setForm] = useState({ display_name: "", external_url: "", campaign_id: "", automation_mode: "manual", external_total: "", external_currency: "USD", external_donor_count: "" });
  const [credentials, setCredentials] = useState({});
  const [campaigns, setCampaigns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [managedBusy, setManagedBusy] = useState(false);
  const [helpDetails, setHelpDetails] = useState("");
  const [error, setError] = useState("");
  const [oauthReadiness, setOauthReadiness] = useState("checking");

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
    setHelpDetails("");
    base44.auth.me()
      .then((me) => base44.entities.Campaign.filter({ created_by_id: me.id }))
      .then((rows) => setCampaigns((rows || []).filter((campaign) => campaign.status === "active" || campaign.id === existing?.campaign_id)))
      .catch(() => setCampaigns([]));
  }, [open, existing]);

  useEffect(() => {
    if (!open || !usesProviderOAuth) return;
    let current = true;
    setOauthReadiness("checking");
    base44.functions.invoke("getAppUserConnector", { platform: platform.id })
      .then(({ data }) => {
        if (!current) return;
        setOauthReadiness(!data?.supported ? "unsupported" :
          data?.configured && data?.connector_id ? "ready" : "not_configured");
      })
      .catch(() => { if (current) setOauthReadiness("unavailable"); });
    return () => { current = false; };
  }, [open, platform.id, usesProviderOAuth]);

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
          : `IFund has not enabled ${platform.name} account sign-in yet. This is an IFund connection setup issue, not something you need to configure on ${platform.name}. The account has not been connected.`);
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
      // An account can be connected before its first IFund campaign is chosen.
      // Provider identity linking should not depend on campaign creation.
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

  const startGuidedConnection = async () => {
    if (managedBusy) return;
    setManagedBusy(true);
    setError("");
    try {
      if (managedAvailable && onManagedConnect) {
        const result = await onManagedConnect({ campaign_id: form.campaign_id || undefined });
        if (result?.state === "completed") {
          setHelpDetails("This connection was verified as working.");
          return;
        }
        setHelpDetails(result?.message || "The connection agent has recorded the next required step. IFund will not show this account as connected until the provider verifies it.");
      } else {
        setHelpDetails("Follow the provider’s sign-in and authorization instructions here. Agent-managed setup requires an eligible subscription and IFund help permission.");
      }
      if (usesProviderOAuth) {
        // This user gesture starts actual provider sign-in, not a fake
        // IFund-generated verification code. The provider owns MFA.
        await connectWithProvider();
      } else if (platform.setupKind === "link") {
        setHelpDetails("Open the platform in your browser, sign in if needed, copy your real campaign/profile URL and paste it into the field above. IFund checks supported public data after saving.");
      } else {
        setHelpDetails("If you’re already logged in on this device, open that platform’s account settings and generate its official app password/token. Enter it only in this secure IFund form; save to request verification.");
      }
    } catch (e) {
      setError(e?.message || "The connection request could not start.");
    } finally { setManagedBusy(false); }
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
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg sm:max-w-md min-w-0 rounded-2xl max-h-[calc(100dvh-1.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y pb-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{existing ? "Manage" : "Connect"} {platform.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">{existing?.status === "connected" && existing?.verification_status === "verified" ? "On" : existing ? "Needs attention" : "Off"} · {usesProviderOAuth ? "Sign in on the platform to connect it." : "Add your link and follow the steps shown."}</p>
        <div className="min-w-0 w-full space-y-4">
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
            <Label>{platform.kind === "app" ? "Linked Interplanetary Fund campaign" : "Optional campaign to promote"}</Label>
            <Select value={form.campaign_id} onValueChange={selectCampaign}>
              <SelectTrigger className="min-w-0 w-full"><SelectValue placeholder={platform.kind === "app" ? "Optional — pick a campaign" : "Pick the campaign to publish first"} /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {platform.kind !== "app" && selectedCampaign && (
            <div className="space-y-1.5">
              <Label>Connection title</Label>
              <p className="w-full min-w-0 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-foreground break-words [overflow-wrap:anywhere]" aria-label="Connection title">{form.display_name}</p>
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
            <p className="text-xs text-muted-foreground mt-1 break-words">{aiAuthorized ? "AI authorization includes OBO access for every platform you connect. Provider sign-in and supported capabilities still determine what can be performed." : "Turn on AI help on the Connections page if you want Interplanetary Fund to act on your behalf through connected platforms."}</p>
          </div>
          {usesProviderOAuth && !existing && (
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1">
              <p className="text-sm font-semibold text-foreground">Connect {platform.name}</p>
              <p className="text-xs text-muted-foreground">You may link a campaign now or after connecting. Use the one-click provider sign-in below. You’ll sign in on {platform.name}, approve the provider permissions, and return here automatically. Your existing IFund AI authorization applies without a second permission screen.</p>
            </div>
          )}
          {usesProviderOAuth && oauthReadiness === "not_configured" &&
            <p role="status" className="text-sm text-amber-600 break-words">IFund still needs to enable {platform.name} sign-in. This is an IFund setup task, not a problem with your account. Connection has not started.</p>}
          {usesProviderOAuth && oauthReadiness === "unavailable" &&
            <p role="status" className="text-sm text-amber-600 break-words">IFund could not check the connection setup right now. You can retry Connect.</p>}
          {usesProviderOAuth && oauthReadiness === "unsupported" &&
            <p role="status" className="text-sm text-amber-600 break-words">Provider sign-in is not available for {platform.name} through IFund yet.</p>}
          {error && <p role="alert" className="text-sm text-red-600 break-words">{error}</p>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="font-semibold text-sm text-foreground mb-2">How IFund connects {platform.name}</p>
            <ol className="list-decimal pl-4 space-y-2 text-xs text-foreground">
              {usesProviderOAuth && <li>IFund opens the official {platform.name} authorization. An existing provider session may be reused on this device.</li>}
              {(platform.steps||[]).filter(step=>step.id!=="auto").map(step=><li key={step.id}>
                <span className="font-medium">{step.label}</span>
                {step.hint && <span className="block mt-0.5">{step.hint}</span>}
              </li>)}
              <li>Return to IFund for a provider verification check. If the account was not verified, the specific required step remains in your AI activity panel.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
            <p className="font-semibold text-sm text-foreground">IFund connection helper</p>
            <p className="text-xs text-muted-foreground">Use this when you are already signed in on the device or need a fresh provider sign-in. IFund can open supported authorization, guide you to the right platform settings, and then verify the connection. Verification codes come from the platform itself.</p>
            <Button type="button" size="sm" variant="outline" className="min-h-11 w-full text-foreground bg-card whitespace-normal h-auto py-3" disabled={managedBusy || connecting} onClick={startGuidedConnection}>
              {managedBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask IFund to connect this account now"}
            </Button>
            {helpDetails && <p role="status" className="text-xs text-foreground break-words">{helpDetails}</p>}
          </div>
          {usesProviderOAuth ? (
            <Button onClick={connectWithProvider} disabled={connecting} className="w-full min-w-0 bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 h-auto px-3 py-3 text-center whitespace-normal break-words leading-snug rounded-xl">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : existing ? `Reconnect ${platform.name}` : `Connect ${platform.name}`}
            </Button>
          ) : (
            <Button onClick={save} disabled={saving || (platform.kind !== "app" && !selectedCampaign)} className="w-full min-w-0 bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 h-auto px-3 py-3 text-center whitespace-normal break-words leading-snug rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : existing ? "Save changes" : `Link to ${platform.name}`}
            </Button>
          )}
          {!existing && managedAvailable && onManagedCreateAccount && platform.kind !== "app" && (
            <Button type="button" variant="outline" onClick={requestManagedAccountSetup} disabled={managedBusy} className="w-full min-w-0 rounded-xl min-h-11 h-auto py-3 px-3 whitespace-normal break-words">
              {managedBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask IFund to help set up a new account"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
