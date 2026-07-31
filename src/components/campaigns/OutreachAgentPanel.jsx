import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2, Pause, Play, Bot, Check, X } from "lucide-react";

// Owner-only panel: activate/pause the autonomous AI Outreach Agent and
// review its activity log. Every action stays pending until the owner approves
// or rejects it — the agent never executes without authorization.
export default function OutreachAgentPanel({ campaign }) {
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState(null);
  const [enabling, setEnabling] = useState(false);

  const load = useCallback(async () => {
    const me = await base44.auth.me();
    setUser(me);
    const acts = await base44.entities.AgentActivity.filter({ campaign_id: campaign.id }, "-created_date", 30);
    setActivities(acts);
  }, [campaign.id]);

  useEffect(() => { load(); }, [load]);

  const hasOutreach = user && ["outreach", "professional", "enterprise", "nonprofit"].includes(user.subscription_tier) &&
    (user.subscription_status === "active" || user.subscription_status === "trialing");

  const toggleEnabled = async () => {
    setEnabling(true);
    await base44.entities.Campaign.update(campaign.id, { outreach_enabled: !campaign.outreach_enabled });
    setEnabling(false);
  };

  const togglePaused = async () => {
    setEnabling(true);
    await base44.entities.Campaign.update(campaign.id, { outreach_paused: !campaign.outreach_paused });
    setEnabling(false);
  };

  const setStatus = async (id, status) => {
    setActivities((prev) => (prev || []).map((a) => (a.id === id ? { ...a, status } : a)));
    await base44.entities.AgentActivity.update(id, { status });
  };

  if (!user || !activities) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-950 to-slate-900 p-5 text-slate-200">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display text-lg text-slate-100">AI Outreach Agent</h3>
        </div>
        {campaign.outreach_enabled ? (
          <Badge variant="outline" className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            {campaign.outreach_paused ? "Paused" : "Active"}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-white/15 text-slate-400">Off</Badge>
        )}
      </div>

      {!hasOutreach ? (
        <div className="mt-3">
          <p className="text-sm text-slate-400 mb-3">
            The AI Outreach Agent works continuously on your behalf — monitoring, drafting outreach, and recommending
            opportunities, all with your approval. Upgrade to unlock it.
          </p>
          <Link to="/subscriptions">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl">
              <Sparkles className="w-4 h-4 mr-2" /> Unlock AI Outreach Agent
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 mt-3 rounded-xl bg-white/5 p-3">
            <div>
              <p className="text-sm text-slate-200 font-medium">Enable autonomous agent</p>
              <p className="text-xs text-slate-400">It runs on a schedule and waits for your approval on every action.</p>
            </div>
            <Switch checked={!!campaign.outreach_enabled} onCheckedChange={toggleEnabled} disabled={enabling} />
          </div>

          {campaign.outreach_enabled && (
            <div className="flex items-center justify-between gap-4 mt-2 rounded-xl bg-white/5 p-3">
              <p className="text-sm text-slate-200">Pause agent temporarily</p>
              <Button size="sm" variant="ghost" onClick={togglePaused} disabled={enabling} className="text-cyan-300 hover:bg-white/10">
                {campaign.outreach_paused ? <><Play className="w-4 h-4 mr-1" />Resume</> : <><Pause className="w-4 h-4 mr-1" />Pause</>}
              </Button>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Activity log</p>
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500">No activity yet. When the agent runs, each action appears here for your review.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activities.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="capitalize border-white/15 text-slate-300">{a.category}</Badge>
                      <span className="text-[11px] text-slate-500">
                        {new Date(a.created_date).toLocaleDateString()} {new Date(a.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200">{a.action}</p>
                    {a.reason && <p className="text-xs text-slate-400 mt-1">Why: {a.reason}</p>}
                    {a.expected_impact && <p className="text-xs text-slate-400">Expected impact: {a.expected_impact}</p>}
                    {a.result && <p className="text-xs text-emerald-400/90">Result: {a.result}</p>}
                    {a.recommended_next_actions && a.recommended_next_actions.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {a.recommended_next_actions.map((n, i) => (
                          <li key={i} className="text-xs text-slate-400">→ {n}</li>
                        ))}
                      </ul>
                    )}
                    {a.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => setStatus(a.id, "approved")} className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
                          <Check className="w-3.5 h-3.5 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, "rejected")} className="h-7 text-red-400 hover:bg-white/10 rounded-lg">
                          <X className="w-3.5 h-3.5 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                    {a.status !== "pending" && (
                      <Badge variant="outline" className="mt-2 capitalize border-white/15 text-slate-400">{a.status}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}