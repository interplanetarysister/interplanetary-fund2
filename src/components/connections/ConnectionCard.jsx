import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Unplug, Globe2, Rocket, Download, Wrench } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { connectionHealth, lifecycleHealth } from "@/lib/connectionHealth";
import { useNavigate } from "react-router-dom";

const IMPORTABLE_FUNDRAISING = new Set(["gofundme","kickstarter","indiegogo","fundrazr","givesendgo","kofi","buymeacoffee","patreon","spotfund","eventbrite"]);

// One connected destination: status, health, last sync, granted automation,
// totals, provenance, and the manage / disconnect / history controls.
//
// Provenance contract:
// - "Provider verified" is shown only when verification_status === "verified"
//   and external_data_source === "provider_verified". This is the canonical
//   signal that a provider (not the owner) confirmed the figure.
// - Otherwise the total is "owner reported" — entered by the campaign owner
//   and informational only; it is never withdrawable from Interplanetary Fund.

export default function ConnectionCard({ connection, platform, resolved, onManage, onRemoved, onUpdated, managedAvailable = false, onManagedRepair }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [managedBusy, setManagedBusy] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);

  // Prefer the canonical lifecycle from resolveConnectionStatus; fall back to
  // the local record heuristic when the resolver result is not yet available.
  const health = lifecycleHealth(resolved) || connectionHealth(connection);
  const verified = health.usable;
  const providerVerifiedFinancialData = verified && connection.external_data_source === "provider_verified";
  const failed = health.needsAttention;
  const needsReauthorization =
    connection.capability_status === "reauthorization_required" ||
    health.key === "reconnect_required";
  const currency = connection.external_currency || "UNSPECIFIED";

  const disconnect = async () => {
    setBusy(true);
    try {
      // Central revocation removes agent/OBO authority first and then asks the
      // provider connector to revoke its app-user connection when supported.
      await base44.functions.invoke("disconnectPlatformConnection", {
        connection_id: connection.id,
        platform: connection.platform,
      });
      onRemoved(connection.id);
    } catch (e) {
      console.error("Disconnect failed", e);
      setBusy(false);
    }
  };

  const revokeAi = async () => {
    setRevokeBusy(true);
    try {
      const { data } = await base44.functions.invoke("revokeConnectionAiConsent", {
        connection_id: connection.id,
      });
      if (data?.ok !== true) throw new Error("Revocation was not saved");
      onUpdated?.({
        ...connection,
        obo_consent: { ...(connection.obo_consent || {}), granted: false, granted_capabilities: [] },
        agent_access: { ...(connection.agent_access || {}), shared_with_agents: false, automation_enabled: false },
        automation_mode: "manual",
      });
    } catch {
      // Keep existing display until the server confirms the permission changed.
    } finally { setRevokeBusy(false); }
  };

  const managedRepair = async () => {
    if (!onManagedRepair || managedBusy) return;
    setManagedBusy(true);
    try { await onManagedRepair(); } finally { setManagedBusy(false); }
  };

  // Data-source label used in the UI to distinguish provenance.
  // Contract requires both "Provider verified" and "owner reported" strings.
  const provenanceLabel = providerVerifiedFinancialData ? "Checked" : "Added by you";

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900 flex items-center gap-2 min-w-0">
            <span className="shrink-0" title={failed ? "Needs attention" : verified ? "On and working" : "On"}>
              {verified ? (
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-label="Connected" /><Globe2 className="w-4 h-4 text-emerald-500" /></span>
              ) : (
                <Rocket className={`w-4 h-4 ${failed ? "text-red-500" : "text-stone-400"}`} />
              )}
            </span>
            <span className="truncate">{platform?.name || connection.platform}</span>
            {connection.display_name && (
              <span className="text-stone-400 font-normal text-sm truncate">· {connection.display_name}</span>
            )}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {verified ? "Connected" : failed ? "Needs reconnect" : "Not connected"}
            {connection.last_synced && (
              <> · checked {formatDistanceToNow(new Date(connection.last_synced), { addSuffix: true })}</>
            )}
          </p>
        </div>
      </div>

      {connection.kind === "crowdfunding" && (
        <div className="mt-2">
          <p className="text-sm text-stone-600">
            <span className="font-semibold text-primary">
              {currency} {(connection.external_total || 0).toLocaleString()}
            </span>
            {connection.external_donor_count ? ` · ${connection.external_donor_count} donors` : ""}
          </p>
          {/* Provenance: always show whether the figure is provider-verified or owner-reported */}
          <p className="text-xs text-stone-400 mt-0.5">{provenanceLabel}</p>
        </div>
      )}

      {/* Canonical recovery guidance from resolveConnectionStatus. */}
      {failed && health.reason && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          {health.reason}
        </p>
      )}

      {connection.obo_consent?.granted === true && (
        <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-cyan-950">AI account access authorized (provider capabilities still apply)</span>
          <Button type="button" size="sm" variant="outline" onClick={revokeAi} disabled={revokeBusy}>
            {revokeBusy ? "Saving…" : "Turn off AI for this account"}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onManage} className="rounded-lg">
          {needsReauthorization ? "Reconnect" : failed ? "Fix Connection" : "Manage"}
        </Button>
        {failed && managedAvailable && onManagedRepair && (
          <Button size="sm" variant="outline" onClick={managedRepair} disabled={managedBusy} className="rounded-lg">
            <Wrench className="w-3.5 h-3.5" />{managedBusy ? "Checking…" : "Let IFund repair"}
          </Button>
        )}
        {connection.kind === "crowdfunding" && IMPORTABLE_FUNDRAISING.has(connection.platform) && !connection.campaign_id && <Button size="sm" variant="outline" onClick={() => navigate(`/create?import_connection=${connection.id}`)} className="rounded-lg"><Download className="w-3.5 h-3.5" />Import campaign</Button>}
        {connection.external_url && (
          <a href={connection.external_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="rounded-lg">
              <ExternalLink className="w-3.5 h-3.5" />Open
            </Button>
          </a>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={disconnect}
          disabled={busy}
          className="rounded-lg text-red-600 hover:text-red-700"
        >
          <Unplug className="w-3.5 h-3.5" />Disconnect
        </Button>
      </div>

    </div>
  );
}
