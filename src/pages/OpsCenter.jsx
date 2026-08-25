import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import OpsAgentCard from "@/components/ops/OpsAgentCard";
import OpsCampaignCard from "@/components/ops/OpsCampaignCard";
import TreasurySummary from "@/components/ops/TreasurySummary";
import OpsReports from "@/components/ops/OpsReports";
import FundMigrationDashboard from "@/components/ops/FundMigrationDashboard";

// Ops Center displays a Base44 operational mirror of authoritative Convex data.
// The mirror is not offline-first and must never be presented as authoritative.
export default function OpsCenter() {
  const [agents, setAgents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [mirrorLoadedAt, setMirrorLoadedAt] = useState(null);
  const [lastConvexRefreshAt, setLastConvexRefreshAt] = useState(null);
  const [lastSyncSucceeded, setLastSyncSucceeded] = useState(false);

  const load = useCallback(async ({ markConvexRefresh = false } = {}) => {
    const [a, c, t, r] = await Promise.all([
      base44.entities.Agent.list("-trust_score", 50),
      base44.entities.MonitoredCampaign.list("-raised_amount", 50),
      base44.entities.TreasurySnapshot.list("-created_date", 1),
      base44.entities.ProtocolReport.list("-generated_at", 20),
    ]);
    setAgents(a);
    setCampaigns(c);
    setTreasury(t[0] || null);
    setReports(r);
    const loadedAt = new Date();
    setMirrorLoadedAt(loadedAt);
    if (markConvexRefresh) setLastConvexRefreshAt(loadedAt);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setSyncError("");
    setLastSyncSucceeded(false);
    try {
      const res = await base44.functions.invoke("syncFromConvex", {});
      if (res.data?.error) throw new Error(res.data.error);
      await load({ markConvexRefresh: true });
      setLastSyncSucceeded(true);
    } catch (e) {
      console.error("Ops Center sync failed:", e);
      setSyncError("Unable to refresh the operational mirror. Verify the authoritative Convex state before taking action.");
    }
    setSyncing(false);
  };

  const activeAgents = agents.filter((a) => (a.status || "").toLowerCase() === "active").length;
  const loadedLabel = mirrorLoadedAt
    ? mirrorLoadedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "not loaded";
  const convexRefreshLabel = lastConvexRefreshAt
    ? lastConvexRefreshAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "not confirmed";

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-slate-100">Ops Center</h1>
            <p className="text-xs text-slate-500">{activeAgents}/{agents.length} agents active · Convex is authoritative</p>
          </div>
          <button onClick={syncNow} disabled={syncing} className="flex items-center gap-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 px-4 min-h-[44px] text-sm font-semibold disabled:opacity-60">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>

        <div className={`mt-3 rounded-xl border p-3 text-xs ${syncError ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : lastSyncSucceeded ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{syncError ? "Mirror refresh failed" : lastSyncSucceeded ? "Mirror refreshed from Convex" : "Operational mirror — not authoritative"}</p>
              <p className="mt-0.5 opacity-80">
                {syncError
                  ? syncError
                  : lastSyncSucceeded
                    ? `Convex refresh confirmed ${convexRefreshLabel}. Mirror snapshot loaded ${loadedLabel}. Convex remains the source of truth.`
                    : `Displayed operational data is a Base44 mirror snapshot loaded ${loadedLabel}. No successful Convex refresh is being claimed. Convex remains the source of truth.`}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="agents" className="mt-4">
            <TabsList className="w-full grid grid-cols-5 bg-white/5 border border-white/10 rounded-xl h-11">
              <TabsTrigger value="agents" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Agents</TabsTrigger>
              <TabsTrigger value="campaigns" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Campaigns</TabsTrigger>
              <TabsTrigger value="treasury" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Treasury</TabsTrigger>
              <TabsTrigger value="migrate" disabled aria-disabled="true" className="text-xs text-slate-500 rounded-lg" title="Migration controls are temporarily unavailable until the authoritative financial workflow is complete.">Migrate</TabsTrigger>
              <TabsTrigger value="reports" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="agents" className="mt-4 space-y-3">{agents.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No agents synced yet — tap Sync Now.</p>}{agents.map((a) => <OpsAgentCard key={a.id} agent={a} />)}</TabsContent>
            <TabsContent value="campaigns" className="mt-4 space-y-3">{campaigns.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No campaigns synced yet — tap Sync Now.</p>}{campaigns.map((c) => <OpsCampaignCard key={c.id} campaign={c} />)}</TabsContent>
            <TabsContent value="treasury" className="mt-4"><TreasurySummary snapshot={treasury} /></TabsContent>
            <TabsContent value="migrate" className="mt-4"><FundMigrationDashboard /></TabsContent>
            <TabsContent value="reports" className="mt-4"><OpsReports reports={reports} /></TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
