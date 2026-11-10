import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart3, Loader2 } from "lucide-react";

const money = (value, currency = "USD") => {
  const amount = Number(value || 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
};

// Owner-facing donation breakdown by funding platform. Reads only the verified
// campaign ledger, so pending or owner-reported money never appears here.
export default function CampaignPlatformAnalytics({ campaign }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    base44.functions.invoke("getCampaignPlatformAnalytics", { campaign_id: campaign.id })
      .then(({ data: payload }) => {
        if (!current) return;
        if (!payload || !Array.isArray(payload.platforms)) throw new Error("Malformed analytics response");
        setData(payload);
      })
      .catch((e) => {
        if (!current) return;
        console.error("Campaign platform analytics failed:", e?.name || "UnknownError");
        setError("We couldn't load the platform breakdown right now.");
      });
    return () => { current = false; };
  }, [campaign.id]);

  const platforms = data?.platforms || [];
  const primaryTotal = data?.totals?.[0] || null;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-display text-xl text-stone-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Donations by platform
        </h3>
        {primaryTotal && (
          <div className="text-right">
            <p className="font-display text-2xl text-stone-900 leading-none">{money(primaryTotal.amount, primaryTotal.currency)}</p>
            <p className="text-xs text-stone-500 mt-1">{primaryTotal.count} verified gift{primaryTotal.count === 1 ? "" : "s"}</p>
          </div>
        )}
      </div>
      <p className="text-sm text-stone-500 mb-4">Where this campaign's money came from, taken from your verified ledger.</p>

      {!data && !error && (
        <div className="flex items-center gap-2 text-sm text-stone-500 py-6 justify-center" role="status" aria-live="polite">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading the ledger…
        </div>
      )}

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {data && platforms.length === 0 && (
        <p className="text-sm text-stone-500 py-4">No verified donations yet. Gifts appear here as soon as the ledger confirms them from any platform.</p>
      )}

      {data && platforms.length > 0 && (
        <ul className="space-y-3">
          {platforms.map((row) => (
            <li key={`${row.platform}-${row.currency}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-stone-900 truncate">{row.label}</span>
                <span className="text-stone-600 whitespace-nowrap">
                  <span className="font-semibold text-stone-900">{money(row.amount, row.currency)}</span>
                  <span className="text-stone-400"> · {row.share}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-stone-100 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600" style={{ width: `${Math.max(row.share, 2)}%` }} />
              </div>
              <p className="text-xs text-stone-400 mt-1">{row.count} gift{row.count === 1 ? "" : "s"}</p>
            </li>
          ))}
        </ul>
      )}

      {data?.mixed_currency && (
        <p className="text-xs text-stone-500 mt-4">Totals are shown per currency. Nothing is converted into one number.</p>
      )}
    </div>
  );
}