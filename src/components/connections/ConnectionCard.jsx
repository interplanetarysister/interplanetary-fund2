import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Unplug, Globe2, Rocket, RefreshCw, Stethoscope, ChevronDown, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { connectionHealth, lifecycleHealth } from "@/lib/connectionHealth";
import { useNavigate } from "react-router-dom";

// One connected destination: status, health, last sync, granted automation,
// totals, provenance, and the manage / disconnect / history controls.
//
// Provenance contract:
// - "Provider verified" is shown only when verification_status === "verified"
//   and external_data_source === "provider_verified". This is the canonical
//   signal that a provider (not the owner) confirmed the figure.
// - Otherwise the total is "owner reported" — entered by the campaign owner
//   and informational only; it is never withdrawable from Interplanetary Fund.

export default function ConnectionCard({ connection, platform, resolved, onManage, onRemoved }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showDoctor, setShowDoctor] = useState(false);

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

      {/* Canonical recovery guidance from resolveConnectionStatus. */}
      {failed && health.reason && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          {health.reason}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onManage} className="rounded-lg">
          {needsReauthorization ? "Reconnect" : failed ? "Fix Connection" : "Manage"}
        </Button>
        {connection.kind === "crowdfunding" && !connection.campaign_id && <Button size="sm" variant="outline" onClick={() => navigate(`/create?import_connection=${connection.id}`)} className="rounded-lg"><Download className="w-3.5 h-3.5" />Import campaign</Button>}
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowDoctor((v) => !v)}
          className="rounded-lg ml-auto"
          aria-expanded={showDoctor}
        >
          <Stethoscope className="w-3.5 h-3.5" />Diagnose
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDoctor ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {showDoctor && (
        <ConnectionDoctor connection={connection} resolved={resolved} />
      )}
    </div>
  );
}

// Connection Doctor — surfaces the canonical resolver's full diagnostic output
// (lifecycle, transport, ownership, verified capabilities, OBO authority, last
// error) so a stuck connection can be troubleshot against the same source of
// truth the platform uses internally.
function ConnectionDoctor({ connection, resolved }) {
  const fields = resolved
    ? [
        { label: "Lifecycle", value: resolved.lifecycle },
        { label: "Ownership", value: resolved.ownership_mode },
        { label: "Transport", value: resolved.transport },
        {
          label: "Capabilities",
          value: resolved.capabilities_verified?.length
            ? resolved.capabilities_verified.join(", ")
            : "none verified",
        },
        {
          label: "OBO authority",
          value: resolved.obo?.authorized ? `active (${resolved.obo.grant_count} grant${resolved.obo.grant_count === 1 ? "" : "s"})` : "not authorized",
        },
        { label: "Last verified", value: resolved.last_verified || "never" },
        { label: "Last error", value: resolved.last_error || "none" },
        { label: "Recovery", value: resolved.recovery_hint || "—" },
      ]
    : [
        { label: "Record status", value: connection.status },
        {
          label: "Verification",
          value: connection.verification_status || "unverified",
        },
        { label: "Capability", value: connection.capability_status || "unknown" },
      ];
  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
      <p className="font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
        <Stethoscope className="w-3.5 h-3.5" /> Connection Doctor
      </p>
      {resolved ? (
        <dl className="grid grid-cols-1 gap-1.5">
          {fields.map((f) => (
            <div key={f.label} className="flex gap-2">
              <dt className="font-medium text-stone-500 w-28 shrink-0">{f.label}</dt>
              <dd className="min-w-0 break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className="grid grid-cols-1 gap-1.5">
          {fields.map((f) => (
            <div key={f.label} className="flex gap-2">
              <dt className="font-medium text-stone-500 w-28 shrink-0">{f.label}</dt>
              <dd className="min-w-0 break-words">{f.value}</dd>
            </div>
          ))}
          <p className="text-stone-400 mt-1">Canonical lifecycle is loading or unavailable.</p>
        </dl>
      )}
    </div>
  );
}