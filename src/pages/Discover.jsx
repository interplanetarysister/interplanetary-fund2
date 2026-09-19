import React, { useEffect, useMemo, useRef, useState } from "react";
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
const MAX_CAMPAIGNS = 100;
const ALLOWED_STATUSES = new Set(["active"]);
const ALLOWED_CATEGORIES = new Set(Object.keys(categoryLabels));

const isFiniteNonNegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

function isSafeCampaignRow(row) {
  if (!row || typeof row !== "object") return false;
  if (typeof row.id !== "string" || row.id.trim().length === 0 || row.id.length > 200) return false;
  if (typeof row.title !== "string" || row.title.trim().length === 0 || row.title.length > 200) return false;
  if (typeof row.category !== "string" || !ALLOWED_CATEGORIES.has(row.category)) return false;
  if (typeof row.status !== "string" || !ALLOWED_STATUSES.has(row.status)) return false;
  if (!isFiniteNonNegative(row.goal_amount) || !isFiniteNonNegative(row.raised_amount)) return false;
  if (row.cover_image_url !== undefined && row.cover_image_url !== null && typeof row.cover_image_url !== "string") return false;
  if (row.summary !== undefined && row.summary !== null && typeof row.summary !== "string") return false;
  if (row.donor_count !== undefined && (!Number.isInteger(row.donor_count) || row.donor_count < 0)) return false;
  return true;
}

function normalizeCampaignRows(result) {
  if (!Array.isArray(result) || result.length > MAX_CAMPAIGNS) throw new Error("invalid_campaign_response");
  const validRows = result.filter(isSafeCampaignRow);
  if (validRows.length !== result.length) throw new Error("invalid_campaign_row");
  const ids = new Set(validRows.map((row) => row.id));
  if (ids.size !== validRows.length) throw new Error("duplicate_campaign_id");
  return validRows;
}

export default function Discover() {
  const [campaigns, setCampaigns] = useState(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const requestGeneration = useRef(0);

  useEffect(() => {
    let mounted = true;
    const generation = ++requestGeneration.current;
    setError(null);
    base44.entities.Campaign.filter({ status: "active" }, "-created_date", MAX_CAMPAIGNS)
      .then((result) => {
        if (!mounted || generation !== requestGeneration.current) return;
        setCampaigns(normalizeCampaignRows(result));
      })
      .catch(() => {
        if (!mounted || generation !== requestGeneration.current) return;
        setCampaigns(null);
        setError(SAFE_DISCOVER_ERROR);
      });
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!campaigns) return [];
    const normalizedSearch = search.trim().toLowerCase();
    return (category === "all" ? campaigns : campaigns.filter((campaign) => campaign.category === category))
      .filter((campaign) => !normalizedSearch || `${campaign.title} ${campaign.summary || ""}`.toLowerCase().includes(normalizedSearch));
  }, [campaigns, category, search]);

  if (error) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setCampaigns(null); setRefreshKey((k) => k + 1); }} /></div>;
  }
  if (!campaigns) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><CampaignGridSkeleton count={6} /></div>;
  }

  const categories = ["all", ...Object.keys(categoryLabels)];

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900 mb-2">Discover campaigns</h1>
          <p className="text-stone-500">What if your support changed everything for someone today? These causes need help right now.</p>
        </div>
        <PageTips pageId="discover" />
      </div>

      <RecommendedCampaigns allCampaigns={campaigns} />

      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns by name or cause…" className="pl-9 max-w-md" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${category === c ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-white border border-stone-200 text-stone-600 hover:border-primary/40 hover:text-primary"}`}>
            {c === "all" ? "All" : categoryLabels[c]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-stone-400 text-sm py-16 text-center">No active campaigns in this category yet — what if yours was the first?</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
        </div>
      )}
    </PullToRefresh>
  );
}
