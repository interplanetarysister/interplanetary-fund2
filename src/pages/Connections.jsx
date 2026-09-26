import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, RefreshCw, Search, ChevronDown } from "lucide-react";
import { ALL_PLATFORMS } from "@/components/connections/platformCatalog";
import AIConsentCard from "@/components/connections/AIConsentCard";
import ConnectionCard from "@/components/connections/ConnectionCard";
import ConnectDialog from "@/components/connections/ConnectDialog";
import PageError from "@/components/PageError";

// The Universal Connections Center — connect once, fund everywhere. Every
// crowdfunding platform and social network Interplanetary Fund can reach,
// managed from a single place.
export default function Connections() {
  const [connections, setConnections] = useState(null);
  const [user, setUser] = useState(null);
  const [dialog, setDialog] = useState(null); // { platform, existing }
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [connectionNotice, setConnectionNotice] = useState(null);
  const [platformSearch, setPlatformSearch] = useState("");
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);

  // Sync Linked Platforms / Count My Money / Migrate Funds all call the single
  // centralized syncExternalFunds engine — never a separate implementation.
  const syncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await base44.functions.invoke("syncExternalFunds", { scope: "user", initiator_type: "user" });
      setSyncResult(data);
      const r = await base44.functions.invoke("listConnections", { scope: "mine" });
      setConnections(r.data.connections);
    } catch (e) {
      setSyncResult({ error: "We couldn’t update your connected platforms right now. Try again." });
    }
    setSyncing(false);
  };

  useEffect(() => {
    (async () => {
     try {
      const me = await base44.auth.me();
      let pending = null;
      try {
        pending = JSON.parse(localStorage.getItem("ifund_pending_platform_connection") || "null");
      } catch { localStorage.removeItem("ifund_pending_platform_connection"); }
      const fresh = pending && pending.userId === me.id && Date.now() - pending.startedAt < 20 * 60 * 1000;
      if (pending && !fresh) localStorage.removeItem("ifund_pending_platform_connection");
      if (fresh) {
        try {
          const { data } = await base44.functions.invoke("finalizeAppUserOAuthConnection", {
            platform: pending.platform, shared_agent_consent: pending.sharedAgentConsent === true,
          });
          if (data?.connected) {
            localStorage.removeItem("ifund_pending_platform_connection");
            setConnectionNotice({ ok: true, text: `${pending.platform} is connected.` });
          } else {
            setConnectionNotice({ ok: false, text: `Finish connecting ${pending.platform}, then return here. If sign-in was cancelled, try again.` });
          }
        } catch (oauthError) {
          console.error("OAuth connection finalization failed:", oauthError);
          setConnectionNotice({ ok: false, text: "We couldn’t finish the connection. Try again." });
        }
      }
      const connRes = await base44.functions.invoke("listConnections", { scope: "mine" });
      setUser(me);
      setConnections(connRes.data.connections);
     } catch (e) {
       setError(e.message || "We couldn't load your connections.");
     }
    })();
  }, [reloadKey]);

  if (error) {
    return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setConnections(null); setReloadKey((key) => key + 1); }} /></div>;
  }
  if (!connections) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const aiAuthorized = !!user?.ai_publishing_consent?.granted;
  const connectedIds = connections.map((c) => c.platform);
  const discoveredTotals = syncResult?.discovered_totals ||
    (syncResult ? [{ currency: "USD", amount: syncResult.total_discovered || 0 }] : []);
  const discoveredSummary = discoveredTotals
    .map(({ currency, amount }) => `${currency} ${Number(amount || 0).toLocaleString()}`)
    .join(", ");
  const availablePlatforms = ALL_PLATFORMS.filter((p) =>
    (p.id === "custom" || !connectedIds.includes(p.id)) &&
    (`${p.name} ${p.kind || ""}`.toLowerCase().includes(platformSearch.trim().toLowerCase()))
  );

  const choosePlatform = (platform) => {
    setDialog({ platform });
    setPlatformSearch("");
    setPlatformMenuOpen(false);
  };

  return (
    <div className="connections-hub max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-5 sm:p-7 shadow-xl mb-7">
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-cyan-50 mb-1">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-white" />
        </span>
        Connections
      </h1>
      <p className="text-slate-300 mb-5">Turn platforms on here. If it says connected, it is ready. If it needs you, we’ll tell you what to do.</p>
      <div className="flex flex-wrap gap-2 text-xs text-cyan-100/80">
        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5">{connections.length} connected</span>
        <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5">Fundraising + social in one place</span>
      </div>
      </div>

      {connectionNotice && (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${connectionNotice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {connectionNotice.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button onClick={syncAll} disabled={syncing} className="rounded-xl">
          {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Refresh now
        </Button>
      </div>
      {syncResult && (
        <div className="mb-6 rounded-xl border border-stone-200 p-3 text-sm">
          {syncResult.error ? (
            <p className="text-red-600">{syncResult.error}</p>
          ) : (
            <p className="text-stone-700">
              {["success", "partial"].includes(syncResult.overall_status)
                ? `Working. ${discoveredSummary ? `${discoveredSummary} found.` : "Your connected platforms were checked."}`
                : syncResult.overall_status === "no_connections"
                  ? "Nothing is on yet. Turn on a platform below to get started."
                  : "One or more connections need attention. Use Fix Connection below."}
            </p>
          )}
        </div>
      )}

      <div className="mb-8">
        <AIConsentCard user={user} onChanged={(v) => setUser((u) => ({ ...u, ai_publishing_consent: v }))} />
      </div>

      {connections.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-xl text-stone-900 mb-1">On and working</h2>
          <p className="text-sm text-stone-500 mb-3">These platforms are already linked.</p>
          <div className="space-y-3">
            {connections.map((c) => (
              <ConnectionCard
                key={c.id}
                connection={c}
                platform={ALL_PLATFORMS.find((p) => p.id === c.platform)}
                onManage={() => setDialog({ platform: { ...(ALL_PLATFORMS.find((p) => p.id === c.platform) || { id: c.platform, name: c.platform, api: "" }), kind: c.kind }, existing: c })}
                onRemoved={(id, updated) => setConnections((prev) => updated ? prev.map((x) => x.id === id ? updated : x) : prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="font-display text-xl text-stone-900 mb-1">Add a platform</h2>
        <p className="text-sm text-stone-500 mb-3">Search for the platform you want to connect. Interplanetary Fund handles the available connection method behind the scenes.</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPlatformMenuOpen((open) => !open)}
            className="w-full min-h-14 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 px-4 py-3 text-left shadow-lg flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            aria-expanded={platformMenuOpen}
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-300/20 flex items-center justify-center shrink-0"><Search className="w-4 h-4 text-cyan-200" /></span>
              <span>
                <span className="block font-semibold text-cyan-50">Choose a platform</span>
                <span className="block text-xs text-slate-400">Fundraising and social platforms</span>
              </span>
            </span>
            <ChevronDown className={`w-5 h-5 text-cyan-200 transition-transform ${platformMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {platformMenuOpen && (
            <div className="mt-2 rounded-2xl border border-cyan-300/20 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="p-3 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    autoFocus
                    value={platformSearch}
                    onChange={(e) => setPlatformSearch(e.target.value)}
                    placeholder="Search platforms…"
                    className="pl-9 h-11 rounded-xl border-cyan-300/20 bg-slate-900 text-cyan-50 placeholder:text-slate-500 focus-visible:ring-cyan-400/50"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {availablePlatforms.length ? availablePlatforms.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => choosePlatform(p)}
                    className="w-full rounded-xl px-3 py-3 flex items-center gap-3 text-left hover:bg-cyan-400/10 focus:bg-cyan-400/10 focus:outline-none transition-colors"
                  >
                    <span className="text-xl w-8 text-center shrink-0" aria-hidden="true">{p.icon || "✦"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-100 truncate">{p.name}</span>
                      <span className="block text-xs text-slate-400 capitalize">{p.kind === "crowdfunding" ? "Fundraising" : "Social"}</span>
                    </span>
                    <span className="text-xs font-semibold text-cyan-200">Connect</span>
                  </button>
                )) : (
                  <p className="px-3 py-6 text-center text-sm text-slate-400">No matching platforms.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {dialog && (
        <ConnectDialog
          platform={dialog.platform}
          existing={dialog.existing}
          aiAuthorized={aiAuthorized}
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          onSaved={(saved) =>
            setConnections((prev) => {
              const exists = prev.some((x) => x.id === saved.id);
              return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
            })
          }
        />
      )}

    </div>
  );
}