import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { Sparkles, TrendingUp } from "lucide-react";

const momentum = (campaign) => {
  const amount = Number(campaign.raised_amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};
const byId = (a, b) => String(a.id).localeCompare(String(b.id));

// One ranking path for anonymous, new, and returning users. Count each
// supported/followed campaign once, regardless of duplicate observation rows.
export function rankRecommendations(campaigns = [], userId = null, supportedIds = [], follows = []) {
  const active = campaigns.filter((c) => c.status === "active");
  const signals = new Set([...supportedIds, ...follows
    .filter((f) => f.user_id === userId).map((f) => f.campaign_id)]);
  const exclude = new Set(signals);
  if (userId) campaigns.forEach((c) => { if (c.created_by_id === userId) exclude.add(c.id); });
  const affinity = new Map();
  campaigns.forEach((c) => {
    if (signals.has(c.id) && c.category) affinity.set(c.category, (affinity.get(c.category) || 0) + 1);
  });
  const mode = affinity.size ? "recommended" : "trending";
  const score = (c) => (affinity.get(c.category) || 0) * 4 + momentum(c) * 0.0002;
  const recs = active.filter((c) => !exclude.has(c.id)).sort((a, b) =>
    (mode === "recommended" ? score(b) - score(a) : momentum(b) - momentum(a)) || byId(a, b)
  ).slice(0, 3);
  return { recs, mode };
}

// A personalized "Recommended for you" feed. Scores active campaigns by the
// categories a user has already followed or supported, excluding campaigns they
// own, follow, or have donated to. New users (no history) see a trending feed
// ranked by raised momentum instead.
export default function RecommendedCampaigns({ allCampaigns }) {
  const [recs, setRecs] = useState(null);
  const [mode, setMode] = useState("recommended");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const campaigns = Array.isArray(allCampaigns) ? allCampaigns : [];
      let me = null;
      try { me = await base44.auth.me(); } catch { me = null; }

      if (!me) {
        const result = rankRecommendations(campaigns);
        if (!cancelled) { setRecs(result.recs); setMode(result.mode); }
        return;
      }

      const [giving, follows] = await Promise.all([
        base44.functions.invoke("getMyGiving", { projection: "campaign_ids" }).catch(() => null),
        base44.entities.FollowedCampaign.filter({ user_id: me.id }, "-created_date", 1000).catch(() => []),
      ]);
      const supportedIds = Array.isArray(giving?.data?.campaign_ids) ? giving.data.campaign_ids : [];
      const result = rankRecommendations(campaigns, me.id, supportedIds, Array.isArray(follows) ? follows : []);
      if (!cancelled) { setRecs(result.recs); setMode(result.mode); }
    })();
    return () => { cancelled = true; };
  }, [allCampaigns]);

  if (!recs || recs.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 font-display text-xl text-stone-900 mb-1">
        {mode === "trending"
          ? <><TrendingUp className="w-4 h-4 text-primary" /> Trending campaigns</>
          : <><Sparkles className="w-4 h-4 text-primary" /> Recommended for you</>}
      </h2>
      <p className="text-xs text-stone-500 mb-4">
        {mode === "trending"
          ? "Causes gaining the most momentum right now."
          : "Based on the campaigns you follow and support."}
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recs.map((c) => <CampaignCard key={c.id} campaign={c} />)}
      </div>
    </section>
  );
}
