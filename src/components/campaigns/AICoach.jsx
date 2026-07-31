import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export default function AICoach({ campaign, updatesCount }) {
  const [tips, setTips] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI fundraising coach. Give 3 short, specific, actionable tips (one sentence each, with a brief why) to improve this campaign. Never guarantee outcomes. Campaign: title "${campaign.title}", category ${campaign.category}, goal $${campaign.goal_amount}, raised $${campaign.raised_amount || 0}, donors ${campaign.donor_count || 0}, story length ${campaign.story?.length || 0} chars, updates posted ${updatesCount}, has cover image: ${!!campaign.cover_image_url}.`,
      response_json_schema: {
        type: "object",
        properties: { tips: { type: "array", items: { type: "string" } } },
      },
    });
    setTips(res.tips || []);
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-slate-950 to-slate-900 rounded-2xl p-5 text-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display text-lg text-slate-100">AI Coach</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={ask} disabled={loading} className="text-cyan-400 hover:text-cyan-300 hover:bg-white/5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get tips"}
        </Button>
      </div>
      {!tips && <p className="text-xs text-slate-500">Personalized coaching for this campaign, on demand.</p>}
      {tips && (
        <ul className="space-y-2.5">
          {tips.map((t, i) => (
            <li key={i} className="text-sm text-slate-300 leading-relaxed flex gap-2.5">
              <span className="text-cyan-400 font-display shrink-0">{i + 1}.</span>{t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}