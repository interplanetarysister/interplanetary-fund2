import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import { Loader2, PlusCircle, Target, Users, ArrowRight } from "lucide-react";
import PageError from "@/components/PageError";

const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// One place to see every live campaign with money raised and still needed.
export default function MyCampaigns() {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setCampaigns(null);
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error("No signed-in member");
      const page = await base44.entities.Campaign.filter(
        { status: "active", created_by_id: me.id },
        { sort: "-created_date", limit: 100 }
      );
      const items = Array.isArray(page) ? page : page?.items;
      if (!Array.isArray(items)) throw new Error("Malformed campaigns response");
      setCampaigns(items);
    } catch (e) {
      console.error("My campaigns load failed:", e?.name || "UnknownError");
      setError("We couldn't load your campaigns. Please try again.");
    }
  };

  useEffect(() => { load(); }, []);

  if (error) return <PageError message={error} onRetry={load} />;
  if (!campaigns) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite">
        <Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading campaigns</span>
      </div>
    );
  }

  const totals = campaigns.reduce((acc, c) => {
    const raised = Number(c.raised_amount || 0);
    const goal = Number(c.goal_amount || 0);
    acc.raised += raised;
    acc.remaining += Math.max(0, goal - raised);
    acc.donors += Number(c.donor_count || 0);
    return acc;
  }, { raised: 0, remaining: 0, donors: 0 });

  return (
    <div className="ifund-experience max-w-5xl mx-auto min-w-0 px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl text-stone-900">My Campaigns</h1>
          <p className="text-sm text-stone-600 mt-1">Every live campaign, its funds raised, and what's still needed.</p>
        </div>
        <Link to="/create">
          <Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90">
            <PlusCircle className="w-4 h-4 mr-2" /> New campaign
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <div className="bg-white rounded-2xl border border-stone-200/70 p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Active</p>
          <p className="font-display text-2xl text-stone-900 mt-1">{campaigns.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/70 p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Raised</p>
          <p className="font-display text-2xl text-stone-900 mt-1">{money(totals.raised)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/70 p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Remaining</p>
          <p className="font-display text-2xl text-stone-900 mt-1">{money(totals.remaining)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/70 p-4">
          <p className="text-xs uppercase tracking-wide text-stone-500">Donors</p>
          <p className="font-display text-2xl text-stone-900 mt-1">{totals.donors.toLocaleString()}</p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <p className="font-display text-lg text-stone-700 mb-1">No active campaigns</p>
          <p className="text-sm text-stone-500 mb-5">Publish a campaign and it will appear here with live totals.</p>
          <Link to="/create">
            <Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90">Start a campaign</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((campaign) => {
            const raised = Number(campaign.raised_amount || 0);
            const goal = Number(campaign.goal_amount || 0);
            const remaining = Math.max(0, goal - raised);
            const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
            return (
              <li key={campaign.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-40 h-32 sm:h-auto bg-stone-100 shrink-0">
                    <Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={campaign.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
                          {categoryLabels[campaign.category] || "Other"}
                        </p>
                        <h2 className="font-display text-lg text-stone-900 leading-snug truncate">{campaign.title}</h2>
                      </div>
                      <Link to={`/campaign/${campaign.id}`} className="text-sm font-semibold text-primary inline-flex items-center gap-1 shrink-0">
                        Manage <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                    <Progress value={pct} className="h-1.5 my-3" />
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                      <span className="text-stone-600"><span className="font-semibold text-stone-900">{money(raised)}</span> raised</span>
                      <span className="text-stone-600"><span className="font-semibold text-stone-900">{money(remaining)}</span> remaining</span>
                      <span className="text-stone-500 flex items-center gap-1.5"><Target className="w-4 h-4" /> Goal {money(goal)}</span>
                      <span className="text-stone-500 flex items-center gap-1.5"><Users className="w-4 h-4" /> {campaign.donor_count || 0} donors</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}