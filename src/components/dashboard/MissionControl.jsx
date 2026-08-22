import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const priorityStyles = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-stone-100 text-stone-600 border-stone-200",
};

export default function MissionControl({ campaigns = [] }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = async () => {
    if (!campaigns.length || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = campaigns.map((c) => ({
        title: c.title,
        category: c.category,
        goal: c.goal_amount,
        raised: c.raised_amount || 0,
        donors: c.donor_count || 0,
        status: c.status,
        has_story: !!c.story && c.story.length > 200,
        has_cover_image: !!c.cover_image_url,
        end_date: c.end_date,
      }));
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Mission Control, the AI strategist of a fundraising platform. Analyze these campaigns and produce 3-5 specific, actionable recommendations to improve fundraising results. Each must include a short reason explaining WHY (explainable AI). These are estimates, never guarantees. Do not take actions, contact donors, publish content, spend money, or change campaign settings. Recommendations require owner approval before execution. Campaigns: ${JSON.stringify(data)}. Today: ${new Date().toISOString().slice(0, 10)}.`,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  reason: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["title", "reason", "priority"],
              },
            },
          },
          required: ["recommendations"],
        },
      });
      const recommendations = Array.isArray(res?.recommendations) ? res.recommendations : [];
      setInsights(recommendations);
    } catch (e) {
      setInsights(null);
      setError(e?.message || "Mission Control couldn't generate recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 rounded-2xl p-6 text-slate-200">
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </span>
          <h2 className="font-display text-lg text-slate-100">Mission Control</h2>
        </div>
        <Button size="sm" onClick={generate} disabled={loading || campaigns.length === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : insights ? "Re-analyze" : "Analyze"}
        </Button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        AI recommendations — you always make the final call.{" "}
        <Link to="/mission" className="text-cyan-400 hover:text-cyan-300 font-medium">Open full Mission Control →</Link>
      </p>
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
          <div className="flex items-start gap-3">
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={generate} disabled={loading} className="shrink-0 text-red-200 hover:text-white">
              <RefreshCw className="w-4 h-4 mr-1" /> Retry
            </Button>
          </div>
        </div>
      )}
      {campaigns.length === 0 && <p className="text-sm text-slate-500">Create your first campaign and Mission Control will start advising you.</p>}
      {insights && !error && (
        insights.length === 0 ? (
          <p className="text-sm text-slate-400">No recommendations were returned. Try again after your campaign data changes.</p>
        ) : (
          <ul className="space-y-3">
            {insights.map((r, i) => (
              <li key={`${r.title}-${i}`} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-100">{r.title}</p>
                  <Badge variant="outline" className={`shrink-0 capitalize ${priorityStyles[r.priority] || priorityStyles.low}`}>{r.priority}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{r.reason}</p>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}