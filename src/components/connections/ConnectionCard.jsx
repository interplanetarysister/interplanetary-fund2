import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Unplug, Globe2, Rocket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// One connected destination: status, health, last sync, granted automation,
// totals, provenance, and the manage / disconnect / history controls.
export default function ConnectionCard({ connection, platform, onManage, onRemoved }) {
  const [busy, setBusy] = useState(false);

  const verified = connection.status === "connected" && connection.verification_status === "verified";
  const failed = connection.status === "error";
  const currency = connection.external_currency || "UNSPECIFIED";

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
            {verified ? "On · Working" : failed ? "Needs attention" : "On · Checking connection"}
            {connection.last_synced && <> · checked {formatDistanceToNow(new Date(connection.last_synced), { addSuffix: true })}</>
          </p>
        </div>
        <span className={`text-sm font-semibold shrink-0 ${failed ? "text-red-600" : "text-emerald-600"}`}>{failed ? "Needs attention" : "On"}</span>
      </div>

      {connection.kind === "crowdfunding" && (
        <p className="text-sm text-stone-600 mt-2">
          <span className="font-semibold text-primary">{currency} {(connection.external_total || 0).toLocaleString()}</span>
          {connection.external_donor_count ? ` · ${connection.external_donor_count} donors` : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onManage} className="rounded-lg">{failed ? "Fix Connection" : "Manage"}</Button>
        {connection.external_url && (
          <a href={connection.external_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" />Open</Button>
          </a>
        )}
        <Button size="sm" variant="outline" onClick={disconnect} disabled={busy} className="rounded-lg text-red-600 hover:text-red-700"><Unplug className="w-3.5 h-3.5" />Disconnect</Button>
      </div>

    </div>
  );
}