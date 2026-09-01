import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Loader2 } from "lucide-react";
import OpsAgentCard from "@/components/ops/OpsAgentCard";
import OpsCampaignCard from "@/components/ops/OpsCampaignCard";
import TreasurySummary from "@/components/ops/TreasurySummary";
import OpsReports from "@/components/ops/OpsReports";
import FundMigrationDashboard from "@/components/ops/FundMigrationDashboard";
import { IN_APP_AGENTS } from "@/components/ops/inAppAgentRoster";
import PageError from "@/components/PageError";

// Ops Center — live mirror of the Convex mission backend. Data is cached in
// Base44 entities so the dashboard works offline; Sync Now refreshes it.
export default function OpsCenter() {
  const [agents, setAgents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
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
    } catch (e) {
      setError(e.message || "We couldn't load Ops Center data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const res = await base44.functions.invoke("syncFromConvex", {});
      if (res.data?.error) throw new Error(res.data.error);
      await load();
    } catch (e) {
      setSyncError(e.message || "Sync failed — showing cached data.");
    }
    setSyncing(false);
  };

  const displayAgents = agents.length ? agents : IN_APP_AGENTS.map((a, i) => ({ ...a, id: `local-${i}` }));
  const activeAgents = displayAgents.filter((a) => (a.status || "").toLowerCase() === "active").length;
  const offline = agents.length === 0;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-slate-100">Ops Center</h1>
            <p className="text-xs text-slate-500">{activeAgents}/{displayAgents.length} agents active{offline ? " · showing in-app agents (Convex offline)" : " · Convex mission backend"}</p>
          </div>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 px-4 min-h-[44px] text-sm font-semibold disabled:opacity-60"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
        {syncError && <p className="mt-2 text-xs text-rose-400">{syncError}</p>}

        {error ? (
          <PageError message={error} onRetry={() => { setError(null); setLoading(true); load(); }} />
        ) : loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="agents" className="mt-4">
            <TabsList className="w-full grid grid-cols-5 bg-white/5 border border-white/10 rounded-xl h-11">
              <TabsTrigger value="agents" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Agents</TabsTrigger>
              <TabsTrigger value="campaigns" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Campaigns</TabsTrigger>
              <TabsTrigger value="treasury" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Treasury</TabsTrigger>
              <TabsTrigger value="migrate" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Migrate</TabsTrigger>
              <TabsTrigger value="reports" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="agents" className="mt-4 space-y-3">
              {offline && <p className="text-xs text-amber-400/80 text-center py-3">Convex mission backend offline — showing the platform's in-app agents. Tap Sync Now to retry.</p>}
              {displayAgents.map((a) => <OpsAgentCard key={a.id} agent={a} />)}
            </TabsContent>
            <TabsContent value="campaigns" className="mt-4 space-y-3">
              {campaigns.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No campaigns synced yet — tap Sync Now.</p>}
              {campaigns.map((c) => <OpsCampaignCard key={c.id} campaign={c} />)}
            </TabsContent>
            <TabsContent value="treasury" className="mt-4">
              <TreasurySummary snapshot={treasury} />
            </TabsContent>
            <TabsContent value="migrate" className="mt-4">
              <FundMigrationDashboard />
            </TabsContent>
            <TabsContent value="reports" className="mt-4">
              <OpsReports reports={reports} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}