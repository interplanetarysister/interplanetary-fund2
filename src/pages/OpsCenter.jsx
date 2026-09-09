import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Loader2 } from "lucide-react";
import OpsAgentCard from "@/components/ops/OpsAgentCard";
import OpsCampaignCard from "@/components/ops/OpsCampaignCard";
import TreasurySummary from "@/components/ops/TreasurySummary";
import OpsReports from "@/components/ops/OpsReports";
import FundMigrationDashboard from "@/components/ops/FundMigrationDashboard";
import PageError from "@/components/PageError";

const SAFE_OPS_ERROR = "We couldn't load Ops Center data right now. Please try again.";
const SAFE_SYNC_ERROR = "Refresh failed. Please try again.";

// Ops Center — Base44 operational data with explicit provider state.
export default function OpsCenter() {
  const [agents, setAgents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [error, setError] = useState(null);
  const [providerState, setProviderState] = useState("unknown");
  const requestGeneration = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    try {
      const [a, c, t, r] = await Promise.all([
        base44.entities.Agent.list("-trust_score", 50),
        base44.entities.MonitoredCampaign.list("-raised_amount", 50),
        base44.entities.TreasurySnapshot.list("-created_date", 1),
        base44.entities.ProtocolReport.list("-generated_at", 20),
      ]);
      if (mounted.current && generation === requestGeneration.current) {
        setAgents(a);
        setCampaigns(c);
        setTreasury(t[0] || null);
        setReports(r);
        setProviderState("available");
        setError(null);
      }
      return true;
    } catch (e) {
      console.error("Ops Center load failed", e);
      if (mounted.current && generation === requestGeneration.current) {
        setProviderState("unavailable");
        setError(SAFE_OPS_ERROR);
      }
      return false;
    } finally {
      if (mounted.current && generation === requestGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
    };
  }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const ok = await load();
      if (!ok && mounted.current) setSyncError(SAFE_SYNC_ERROR);
    } catch (e) {
      console.error("Ops Center refresh failed", e);
      if (mounted.current) setSyncError(SAFE_SYNC_ERROR);
    } finally {
      if (mounted.current) setSyncing(false);
    }
  };

  const hasAgentData = providerState === "available";
  const activeAgents = agents.filter((a) => (a.status || "").toLowerCase() === "active").length;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-slate-100">Ops Center</h1>
            <p className="text-xs text-slate-500">
              {hasAgentData ? `${activeAgents}/${agents.length} agents active · Base44 operational data` : "Agent status unavailable · Base44 operational data not confirmed"}
            </p>
          </div>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 px-4 min-h-[44px] text-sm font-semibold disabled:opacity-60"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {syncError && <p className="mt-2 text-xs text-rose-400" role="alert">{syncError}</p>}

        {error ? (
          <PageError message={error} onRetry={() => { setError(null); setLoading(true); load(); }} />
        ) : loading ? (
          <div className="flex justify-center py-20" role="status" aria-live="polite"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /><span className="sr-only">Loading Ops Center</span></div>
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
              {!hasAgentData && <p className="text-xs text-amber-400/80 text-center py-3">Agent status is currently unavailable. No synthetic agent data is shown.</p>}
              {hasAgentData && agents.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No operational agents were returned.</p>}
              {agents.map((a) => <OpsAgentCard key={a.id} agent={a} />)}
            </TabsContent>
            <TabsContent value="campaigns" className="mt-4 space-y-3">
              {campaigns.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No campaigns synced yet.</p>}
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
