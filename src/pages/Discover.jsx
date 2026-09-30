import React, { useState, useEffect, useRef } from "react";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { base44 } from "@/api/base44Client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import RecommendedCampaigns from "@/components/discover/RecommendedCampaigns";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { CampaignGridSkeleton } from "@/components/mobile/Skeletons";
import PageError from "@/components/PageError";
import PageTips from "@/components/coach/PageTips";

const SAFE_DISCOVER_ERROR = "We couldn't load campaigns. Please try again.";
const MAX_CAMPAIGNS = 100;

function isValidCampaignRow(row) {
  if (!row || typeof row !== "object") return false;
  if (typeof row.id !== "string" || row.id.length === 0 || row.id.length > 160) return false;
  if (typeof row.title !== "string" || row.title.length === 0 || row.title.length > 240) return false;
  if (typeof row.category !== "string" || !(row.category in categoryLabels)) return false;
  if (row.status !== "active") return false;
  if (row.summary != null && (typeof row.summary !== "string" || row.summary.length > 2000)) return false;
  return true;
}

function normalizeCampaignRows(value) {
  if (!Array.isArray(value) || value.length > MAX_CAMPAIGNS) return null;
  const ids = new Set();
  const rows = [];
  for (const row of value) {
    if (!isValidCampaignRow(row) || ids.has(row.id)) return null;
    ids.add(row.id);
    rows.push(row);
  }
  return rows;
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
    setCampaigns(null);

    base44.entities.Campaign.filter({ status: "active" }, "-created_date", MAX_CAMPAIGNS)
      .then((value) => {
        if (!mounted || generation !== requestGeneration.current) return;
        const normalized = normalizeCampaignRows(value);
        if (!normalized) {
          setError(SAFE_DISCOVER_ERROR);
          return;
        }
        setCampaigns(normalized);
      })
      .catch(() => {
        if (!mounted || generation !== requestGeneration.current) return;
        setError(SAFE_DISCOVER_ERROR);
      });

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  if (error) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setCampaigns(null); setRefreshKey((k) => k + 1); }} /></div>;
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
