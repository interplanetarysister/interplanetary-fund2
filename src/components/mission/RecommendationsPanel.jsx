import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import RecommendationCard from "./RecommendationCard";
import { Loader2 } from "lucide-react";

export default function RecommendationsPanel({ refreshKey }) {
  const [recs, setRecs] = useState(null);

  const load = useCallback(async () => {
    const me = await base44.auth.me();
    const items = await base44.entities.Recommendation.filter({ created_by_id: me.id }, "-created_date", 30);
    setRecs(items);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (!recs) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-orange-600" /></div>;
  }

  const setStatus = async (rec, status) => {
    setRecs((prev) => prev.map((r) => (r.id === rec.id ? { ...r, status } : r)));
    await base44.entities.Recommendation.update(rec.id, { status });
  };

  const open = recs.filter((r) => r.status === "open");
  const resolved = recs.filter((r) => r.status !== "open");

  return (
    <div className="space-y-4">
      {recs.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-12">No recommendations yet — run an analysis to get your ranked action list.</p>
      )}
      {open.map((r) => <RecommendationCard key={r.id} rec={r} onStatus={setStatus} />)}
      {resolved.length > 0 && (
        <>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide pt-2">Resolved</p>
          {resolved.map((r) => <RecommendationCard key={r.id} rec={r} onStatus={setStatus} />)}
        </>
      )}
    </div>
  );
}