import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Unplug, History, Globe2, Rocket, KeyRound } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AUTOMATION_MODES } from "./platformCatalog";

// One connected destination: status, health, last sync, granted automation,
// totals, provenance, and the manage / disconnect / history controls.
export default function ConnectionCard({ connection, platform, onManage, onRemoved, subscriptionActive, onFetchCredentials }) {
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const verified = connection.status === "connected" && connection.verification_status === "verified";
  const failed = connection.status === "error";
  const providerAmount = connection.external_data_source === "provider_verified";
  const currency = connection.external_currency || "UNSPECIFIED";
  const mode = AUTOMATION_MODES.find((m) => m.value === connection.automation_mode);

  const disconnect = async () => {
    setBusy(true);
    await base44.entities.PlatformConnection.delete(connection.id);
    onRemoved(connection.id);
  };


  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900 flex items-center gap-2 min-w-0">
            <span className="shrink-0" title={verified ? "Provider verified" : failed ? "Connection needs attention" : "Configured; provider verification pending"}>
              {verified ? <Globe2 className="w-4 h-4 text-emerald-500" /> : <Rocket className={`w-4 h-4 ${failed ? "text-red-500" : "text-stone-400"}`} />}
            </span>
            <span className="truncate">{platform?.name || connection.platform}</span>
            {connection.display_name && <span className="text-stone-400 font-normal text-sm truncate">· {connection.display_name}</span>}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {verified ? "Provider verified" : failed ? `Error: ${connection.last_error || "connection issue"}` : "Configured · provider verification pending"}
            {connection.last_synced && <> · last provider event {formatDistanceToNow(new Date(connection.last_synced), { addSuffix: true })}</>}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">{mode?.label || "Manual"}</Badge>
      </div>

      {connection.kind === "crowdfunding" && (
        <p className="text-sm text-stone-600 mt-2">
          <span className="font-semibold text-primary">{currency} {(connection.external_total || 0).toLocaleString()}</span> reported
          · {connection.external_donor_count || 0} donors · {providerAmount ? "provider verified" : "owner reported · informational"}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onManage} className="rounded-lg">Manage / Sync</Button>
        {subscriptionActive && (
          <Button size="sm" variant="outline" onClick={() => onFetchCredentials?.(platform)} disabled={busy} className="rounded-lg"><KeyRound className="w-3.5 h-3.5" />Fetch Credentials</Button>
        )}
        {connection.external_url && (
          <a href={connection.external_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" />Open</Button>
          </a>
        )}
        <Button size="sm" variant="outline" onClick={() => setShowHistory((v) => !v)} className="rounded-lg"><History className="w-3.5 h-3.5" />History</Button>
        <Button size="sm" variant="outline" onClick={disconnect} disabled={busy} className="rounded-lg text-red-600 hover:text-red-700"><Unplug className="w-3.5 h-3.5" />Disconnect</Button>
      </div>

      {showHistory && (
        <ul className="mt-3 border-t border-stone-100 pt-3 space-y-1.5 max-h-40 overflow-y-auto">
          {(connection.history || []).slice().reverse().map((h, i) => (
            <li key={i} className="text-xs text-stone-500">
              <span className="font-medium text-stone-700 capitalize">{h.event}</span> — {h.detail} · {h.at ? formatDistanceToNow(new Date(h.at), { addSuffix: true }) : ""}
            </li>
          ))}
          {!(connection.history || []).length && <li className="text-xs text-stone-400">No activity yet.</li>}
        </ul>
      )}
    </div>
  );
}