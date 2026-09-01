import React, { useState, useEffect } from "react";
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

export default function Analytics() {
  const [data, setData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
     try {
      const me = await base44.auth.me();
      const [campaigns, communities, institutions, volunteerOpps, applications, opportunities] = await Promise.all([
        base44.entities.Campaign.filter({ created_by_id: me.id }),
        base44.entities.Community.list("-created_date", 200),
        base44.entities.Institution.list("-created_date", 200),
        base44.entities.VolunteerOpportunity.list("-created_date", 200),
        base44.entities.GrantApplication.filter({ applicant_user_id: me.id }),
        base44.entities.InstitutionOpportunity.list("-created_date", 200),
      ]);
      const dResults = await Promise.all(
        campaigns.map((c) => base44.functions.invoke("getCampaignDonations", { campaign_id: c.id }))
      );
      const donationLists = dResults.map((r) => (r.data && r.data.donations) || []);
      const signupLists = await Promise.all(
        volunteerOpps.map((o) => base44.entities.VolunteerSignup.filter({ opportunity_id: o.id }))
      );
      setData({
        campaigns,
        communities,
        institutions,
        volunteerOpps,
        applications,
        opportunities,
        donations: donationLists.flat(),
        signups: signupLists.flat(),
      });
     } catch (e) {
       setError(e.message || "We couldn't load your analytics.");
     }
    })();
  }, [refreshKey]);

  if (error) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setData(null); setRefreshKey((k) => k + 1); }} /></div>;
  }
  if (!data) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Command Center</h1>
      <p className="text-stone-500 mt-1 mb-6">
        What happened, why, what's likely next, and what to do about it.
      </p>

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
          <AlertCenter
            campaigns={data.campaigns}
            opportunities={data.opportunities}
            communities={data.communities}
            volunteerOpps={data.volunteerOpps}
            applications={data.applications}
          />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsPanel data={data} />
        </TabsContent>
      </Tabs>
    </PullToRefresh>
  );
}