import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Coins, CheckCircle2, AlertTriangle } from "lucide-react";

// "Count My Money" — immediately retrieves and reconciles available donation
// and fund information from every connected, supported fundraising platform
// for every campaign owned by the signed-in user. Calls the single centralized
// syncExternalFunds engine (the same one scheduled daily sync, Sync Linked
// Platforms, and Migrate Funds use).
export default function CountMyMoney() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data } = await base44.functions.invoke("syncExternalFunds", { scope: "user", initiator_type: "user" });
      setResult(data);
    } catch (e) {
      setError("We couldn't count your money right now. Please try again.");
    }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
        <Coins className="w-3.5 h-3.5" /> Count My Money
      </p>
      <p className="text-sm text-stone-600 mb-4">
        Immediately retrieve and reconcile available funds from every connected fundraising platform for every campaign you own.
      </p>
      <Button onClick={run} disabled={busy} className="rounded-xl">
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Counting…</> : <><Coins className="w-4 h-4 mr-2" /> Count My Money</>}
      </Button>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {result && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="text-stone-700">
            <span className="font-medium">{result.campaigns_covered}</span> campaigns ·{" "}
            <span className="font-medium">${(result.total_discovered || 0).toLocaleString()}</span> discovered ·{" "}
            <span className="font-medium">{result.total_imported}</span> imported · status:{" "}
            <span className="font-medium">{result.overall_status}</span>
          </p>
          {(result.provider_results || []).map((r, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-stone-200 p-2">
              {r.status === "error" ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="font-medium text-stone-800 capitalize">{r.provider}: {r.status.replace(/_/g, " ")}</p>
                <p className="text-xs text-stone-500">${(r.amount_discovered || 0).toLocaleString()} discovered · {r.transactions_imported} imported</p>
                {r.note && <p className="text-xs text-stone-400 mt-0.5">{r.note}</p>}
                {r.error && <p className="text-xs text-red-500 mt-0.5">{r.error}</p>}
              </div>
            </div>
          ))}
          {!(result.provider_results || []).length && (
            <p className="text-xs text-stone-400">No connected fundraising platforms found. Connect a platform in the Connections Center to start syncing.</p>
          )}
        </div>
      )}
    </div>
  );
}