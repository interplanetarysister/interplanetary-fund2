import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/StatCard";
import MissionControl from "@/components/dashboard/MissionControl";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { DollarSign, Users, Flame, PlusCircle, Loader2, Sparkles } from "lucide-react";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setUser(me);
      const mine = await base44.entities.Campaign.filter({ created_by_id: me.id }, "-created_date");
      setCampaigns(mine);
    })();
  }, []);

  if (!campaigns) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>;
  }

  const needsOnboarding = !user?.onboarding_completed;

  const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount || 0), 0);
  const totalDonors = campaigns.reduce((s, c) => s + (c.donor_count || 0), 0);
  const active = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-stone-500 mb-1">Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}</p>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Your fundraising HQ</h1>
        </div>
        <Link to="/create">
          <Button className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
            <PlusCircle className="w-4 h-4 mr-2" /> New Campaign
          </Button>
        </Link>
      </div>

      {needsOnboarding && (
        <Link to="/onboarding" className="block mb-6">
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 text-white p-4">
            <span className="shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium text-sm">Set up your intelligent fundraising OS</p>
              <p className="text-xs text-white/80">Connect platforms, activate the AI Growth Engine, and automate your fundraising.</p>
            </div>
            <PlusCircle className="w-5 h-5 shrink-0" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Raised" value={`$${totalRaised.toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Supporters" value={totalDonors.toLocaleString()} icon={Users} />
        <StatCard label="Active Campaigns" value={active} icon={Flame} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-display text-xl text-stone-900 mb-4">Your campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
              <p className="font-display text-lg text-stone-700 mb-2">No campaigns yet</p>
              <p className="text-sm text-stone-500 mb-5">Launch your first campaign in minutes with the guided builder.</p>
              <Link to="/create"><Button className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">Start a campaign</Button></Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
            </div>
          )}
        </div>
        <MissionControl campaigns={campaigns} />
      </div>
    </div>
  );
}