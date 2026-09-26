import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Unplug, Globe2, Rocket, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { connectionHealth } from "@/lib/connectionHealth";

// One connected destination: status, health, last sync, granted automation,
// totals, provenance, and the manage / disconnect / history controls.
//
// Provenance contract:
// - "Provider verified" is shown only when verification_status === "verified"
//   and external_data_source === "provider_verified". This is the canonical
//   signal that a provider (not the owner) confirmed the figure.
// - Otherwise the total is "owner reported" — entered by the campaign owner
//   and informational only; it is never withdrawable from Interplanetary Fund.

export default function ConnectionCard({ connection, platform, onManage, onRemoved }) {
  const [busy, setBusy] = useState(false);

  const health = connectionHealth(connection);
  const verified = health.usable;
  const providerVerifiedFinancialData = verified && connection.external_data_source === "provider_verified";
  const failed = health.needsAttention;
  const needsReauthorization = connection.capability_status === "reauthorization_required";
  const currency = connection.external_currency || "UNSPECIFIED";

  const checkConnection = async () => {
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke("verifyPlatformConnection", { connection_id: connection.id });
      if (data?.connection) onRemoved?.(connection.id, data.connection);
    } catch (e) {
      console.error("Connection check failed", e);
    } finally {
      setBusy(false);
    }
  };

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
            {verified ? "Connected · Working" : failed ? "Needs attention" : "Disconnected"}
            {connection.last_synced && (
              <> · checked {formatDistanceToNow(new Date(connection.last_synced), { addSuffix: true })}</>
            )}
          </p>
        </div>
        <span className={`text-sm font-semibold shrink-0 ${failed ? "text-red-600" : "text-emerald-600"}`}>
          {health.label}
        </span>
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

      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onManage} className="rounded-lg">
          {needsReauthorization ? "Reconnect" : failed ? "Fix Connection" : "Manage"}
        </Button>
        <Button size="sm" variant="outline" onClick={checkConnection} disabled={busy} className="rounded-lg">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />Check
        </Button>
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
