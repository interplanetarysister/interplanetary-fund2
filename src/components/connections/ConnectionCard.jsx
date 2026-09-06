import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw, Unplug, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AUTOMATION_MODES } from "./platformCatalog";

// One connected destination: status, health, last sync, granted automation,
// totals, and the manage / refresh / disconnect / history controls.
export default function ConnectionCard({ connection, platform, onManage, onRemoved, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const healthy = connection.status === "connected";
  const mode = AUTOMATION_MODES.find((m) => m.value === connection.automation_mode);

  const disconnect = async () => {
    setBusy(true);
    await base44.entities.PlatformConnection.delete(connection.id);
    onRemoved(connection.id);
  };

  const refresh = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const updated = await base44.entities.PlatformConnection.update(connection.id, {
      status: "connected",
      last_synced: now,
      last_error: "",
      history: [...(connection.history || []), { at: now, event: "refreshed", detail: "Connection refreshed" }].slice(-30),
    });
    onUpdated(updated || { ...connection, status: "connected", last_synced: now });
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-stone-900 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${healthy ? "bg-emerald-500" : "bg-red-500"}`} />
            {platform?.name || connection.platform}
            {connection.display_name && <span className="text-stone-400 font-normal text-sm truncate">· {connection.display_name}</span>}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {healthy ? "Healthy" : `Error: ${connection.last_error || "connection issue"}`}
            {connection.last_synced && <> · synced {formatDistanceToNow(new Date(connection.last_synced), { addSuffix: true })}</>}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">{mode?.label || "Manual"}</Badge>
      </div>

      {connection.kind === "crowdfunding" && (
        <p className="text-sm text-stone-600 mt-2">
          <span className="font-semibold text-primary">${(connection.external_total || 0).toLocaleString()}</span> raised
          · {connection.external_donor_count || 0} donors on that platform
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onManage} className="rounded-lg">Manage / Sync</Button>
        <Button size="sm" variant="outline" onClick={refresh} disabled={busy} className="rounded-lg"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
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