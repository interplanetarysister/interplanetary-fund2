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

const SAFE_DISCOVER_ERROR = "We couldn't load campaigns right now. Please try again.";
const MAX_CAMPAIGNS = 100;
const VALID_STATUSES = new Set(["active"]);
const VALID_CATEGORIES = new Set(["medical", "emergency", "education", "community", "animals", "business", "memorial", "disaster_relief", "creative", "other"]);

function isSafeCampaignRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  if (typeof row.id !== "string" || row.id.length < 1 || row.id.length > 200) return false;
  if (typeof row.title !== "string" || row.title.trim().length < 1 || row.title.length > 240) return false;
  if (typeof row.status !== "string" || !VALID_STATUSES.has(row.status)) return false;
  if (typeof row.category !== "string" || !VALID_CATEGORIES.has(row.category)) return false;
  if (typeof row.goal_amount !== "number" || !Number.isFinite(row.goal_amount) || row.goal_amount < 0) return false;
  if (typeof row.raised_amount !== "number" || !Number.isFinite(row.raised_amount) || row.raised_amount < 0) return false;
  if (typeof row.donor_count !== "number" || !Number.isInteger(row.donor_count) || row.donor_count < 0) return false;
  if (row.cover_image_url != null && (typeof row.cover_image_url !== "string" || row.cover_image_url.length > 2048)) return false;
  return true;
}

function validateCampaignPayload(result) {
  if (!Array.isArray(result) || result.length > MAX_CAMPAIGNS) return null;
  const seen = new Set();
  const valid = [];
  for (const row of result) {
    if (!isSafeCampaignRow(row) || seen.has(row.id)) return null;
    seen.add(row.id);
    valid.push(row);
  }
  return valid;
}

export default function Discover() {
  const [campaigns, setCampaigns] = useState(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const requestId = ++requestRef.current;
    setError(null);
    setCampaigns(null);

    base44.entities.Campaign.filter({ status: "active" }, "-created_date", MAX_CAMPAIGNS)
      .then((result) => {
        const validated = validateCampaignPayload(result);
        if (!validated) throw new Error("invalid-campaign-payload");
        if (mountedRef.current && requestRef.current === requestId) setCampaigns(validated);
      })
      .catch(() => {
        if (mountedRef.current && requestRef.current === requestId) {
          setCampaigns(null);
          setError(SAFE_DISCOVER_ERROR);
        }
      });

    return () => {
      mountedRef.current = false;
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
          <p className="text-stone-500">What if your support changed everything for someone today? These causes need help right now.</p>
        </div>
        <PageTips pageId="discover" />
      </div>
      <RecommendedCampaigns allCampaigns={campaigns} />
      <div className="relative mb-6"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns by name or cause…" className="pl-9 max-w-md" /></div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">{categories.map((c) => <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${category === c ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-white border border-stone-200 text-stone-600 hover:border-primary/40 hover:text-primary"}`}>{c === "all" ? "All" : categoryLabels[c]}</button>)}</div>
      {filtered.length === 0 ? <p className="text-stone-400 text-sm py-16 text-center">No active campaigns in this category yet — what if yours was the first?</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map((c) => <CampaignCard key={c.id} campaign={c} />)}</div>}
    </PullToRefresh>
  );
}
