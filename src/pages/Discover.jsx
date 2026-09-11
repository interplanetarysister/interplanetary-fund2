import React, { useCallback, useEffect, useRef, useState } from "react";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { base44 } from "@/api/base44Client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import RecommendedCampaigns from "@/components/discover/RecommendedCampaigns";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { CampaignGridSkeleton } from "@/components/mobile/Skeletons";
import PageError from "@/components/PageError";
import PageTips from "@/components/coach/PageTips";

const SAFE_DISCOVER_ERROR = "We couldn't load campaigns right now. Please try again.";

function normalizeCampaigns(payload) {
  if (!Array.isArray(payload)) throw new Error("invalid campaign payload");
  if (payload.some((campaign) => (
    !campaign ||
    typeof campaign !== "object" ||
    typeof campaign.id !== "string" ||
    typeof campaign.title !== "string" ||
    campaign.status !== "active"
  ))) {
    throw new Error("invalid campaign row");
  }
  return payload;
}

export default function Discover() {
  const [campaigns, setCampaigns] = useState(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadCampaigns = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const response = await base44.entities.Campaign.filter({ status: "active" }, "-created_date", 100);
      const normalized = normalizeCampaigns(response);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setCampaigns(normalized);
      setError(null);
    } catch (e) {
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setError(SAFE_DISCOVER_ERROR);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns, refreshKey]);

  if (error && !campaigns) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setRefreshKey((k) => k + 1); }} /></div>;
  }
  if (!campaigns) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><CampaignGridSkeleton count={6} /></div>;
  }

  const filtered = (category === "all" ? campaigns : campaigns.filter((c) => c.category === category))
    .filter((c) => !search || `${c.title} ${c.summary || ""}`.toLowerCase().includes(search.toLowerCase()));
  const categories = ["all", ...Object.keys(categoryLabels)];

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900 mb-2">Discover campaigns</h1>
          <p className="text-stone-500">
            What if your support changed everything for someone today? These causes need help right now.
          </p>
        </div>
        <PageTips pageId="discover" />
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>}
      <RecommendedCampaigns allCampaigns={campaigns} />

      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns by name or cause…" className="pl-9 max-w-md" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              category === c
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-white border border-stone-200 text-stone-600 hover:border-primary/40 hover:text-primary"
            }`}>
            {c === "all" ? "All" : categoryLabels[c]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-stone-400 text-sm py-16 text-center">
          No active campaigns in this category yet — what if yours was the first?
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </PullToRefresh>
  );
}
