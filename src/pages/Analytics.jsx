import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MetricsGrid from "@/components/analytics/MetricsGrid";
import RevenueChart from "@/components/analytics/RevenueChart";
import CampaignPerformance from "@/components/analytics/CampaignPerformance";
import AlertCenter from "@/components/analytics/AlertCenter";
import ReportsPanel from "@/components/analytics/ReportsPanel";
import { Loader2 } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import PageError from "@/components/PageError";
import { isRecord, isNonEmptyString, loadAnalyticsData } from "@/lib/analyticsData";

const SAFE_ANALYTICS_ERROR = "We couldn't load your analytics right now. Please try again.";
const SAFE_ANALYTICS_REFRESH_ERROR = "We couldn't refresh your analytics. Your last complete view is preserved; please try again.";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const requestGeneration = useRef(0);

  useEffect(() => {
    let mounted = true;
    const requestId = ++requestGeneration.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const me = await base44.auth.me();
        if (!isRecord(me) || !isNonEmptyString(me.id)) throw new Error("Malformed auth response");
        const nextData = await loadAnalyticsData(base44, me.id);
        if (mounted && requestId === requestGeneration.current) {
          setData(nextData);
          setError(null);
        }
      } catch {
        if (mounted && requestId === requestGeneration.current) setError(SAFE_ANALYTICS_ERROR);
      } finally {
        if (mounted && requestId === requestGeneration.current) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  if (error && !data) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={SAFE_ANALYTICS_ERROR} onRetry={() => setRefreshKey((k) => k + 1)} /></div>;
  }
  if (!data && loading) {
    return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" /><span className="sr-only">Loading analytics</span></div>;
  }
  if (!data) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={SAFE_ANALYTICS_ERROR} onRetry={() => setRefreshKey((k) => k + 1)} /></div>;
  }

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Command Center</h1>
      <p className="text-stone-500 mt-1 mb-6">
        What happened, why, what's likely next, and what to do about it.
      </p>
      {loading && <p role="status" aria-live="polite" className="mb-3 text-xs text-stone-500">Refreshing analytics…</p>}
      {error && <div role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{SAFE_ANALYTICS_REFRESH_ERROR} <button type="button" className="underline" onClick={() => setRefreshKey((k) => k + 1)}>Retry</button></div>}

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <MetricsGrid data={data} />
          <RevenueChart donations={data.donations} />
          <CampaignPerformance campaigns={data.campaigns} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertCenter campaigns={data.campaigns} opportunities={data.opportunities} communities={data.communities} volunteerOpps={data.volunteerOpps} applications={data.applications} />
        </TabsContent>
        <TabsContent value="reports"><ReportsPanel data={data} /></TabsContent>
      </Tabs>
    </PullToRefresh>
  );
}
