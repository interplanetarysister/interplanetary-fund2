import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { Loader2 } from "lucide-react";

export default function Discover() {
  const [campaigns, setCampaigns] = useState(null);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    base44.entities.Campaign.filter({ status: "active" }, "-created_date", 100).then(setCampaigns);
  }, []);

  if (!campaigns) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const filtered = category === "all" ? campaigns : campaigns.filter((c) => c.category === category);
  const categories = ["all", ...Object.keys(categoryLabels)];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900 mb-2">Discover campaigns</h1>
      <p className="text-stone-500 mb-6">Causes that need your support right now.</p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              category === c ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300"
            }`}>
            {c === "all" ? "All" : categoryLabels[c]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-stone-400 text-sm py-16 text-center">No active campaigns in this category yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  );
}