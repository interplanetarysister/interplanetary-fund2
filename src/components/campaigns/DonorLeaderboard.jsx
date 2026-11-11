import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Loader2 } from "lucide-react";

const money = (value) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const medals = ["bg-amber-100 text-amber-700", "bg-slate-200 text-slate-700", "bg-orange-100 text-orange-700"];

// Top supporters by total given. Anonymous gifts are excluded by the server,
// and only a display name plus total ever reaches the browser.
export default function DonorLeaderboard({ campaignId }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!campaignId) return undefined;
    base44.functions.invoke("getCampaignDonorLeaderboard", { campaign_id: campaignId })
      .then(({ data: result }) => { if (!cancelled) setData(result || { leaderboard: [] }); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [campaignId]);

  if (failed) return null;
  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm" role="status" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin" />Loading top supporters…</p>
      </div>
    );
  }
  const rows = Array.isArray(data.leaderboard) ? data.leaderboard : [];
  if (!rows.length) return null;

  return (
    <section aria-labelledby="donor-leaderboard-heading" className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-5 h-5 text-amber-500" aria-hidden="true" />
        <h3 id="donor-leaderboard-heading" className="font-display text-lg text-stone-900">Top supporters</h3>
      </div>
      <ol className="space-y-2.5">
        {rows.map((donor, index) => (
          <li key={`${donor.name}-${index}`} className="flex items-center gap-3">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${medals[index] || "bg-stone-100 text-stone-500"}`}>
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{donor.name}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">{money(donor.total)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-stone-400">Ranked by total given to this campaign. Anonymous supporters are not listed.</p>
    </section>
  );
}