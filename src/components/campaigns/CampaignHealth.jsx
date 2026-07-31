import React from "react";
import { Activity, Check, X } from "lucide-react";

export default function CampaignHealth({ campaign, updatesCount }) {
  const checks = [
    { label: "Detailed story (200+ characters)", ok: !!campaign.story && campaign.story.length >= 200 },
    { label: "Cover image added", ok: !!campaign.cover_image_url },
    { label: "Short summary written", ok: !!campaign.summary },
    { label: "At least one update posted", ok: updatesCount > 0 },
    { label: "End date set", ok: !!campaign.end_date },
    { label: "First donation received", ok: (campaign.donor_count || 0) > 0 },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-display text-lg text-stone-900">Campaign Health</h3>
        </div>
        <span className={`font-display text-2xl ${score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-red-500"}`}>{score}%</span>
      </div>
      <ul className="space-y-2.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2.5 text-sm">
            {c.ok ? (
              <span className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-emerald-600" /></span>
            ) : (
              <span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center shrink-0"><X className="w-3 h-3 text-stone-400" /></span>
            )}
            <span className={c.ok ? "text-stone-700" : "text-stone-400"}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}