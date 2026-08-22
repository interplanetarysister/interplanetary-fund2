import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/StatCard";
import MissionControl from "@/components/dashboard/MissionControl";
import FollowFeed from "@/components/dashboard/FollowFeed";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { CampaignGridSkeleton } from "@/components/mobile/Skeletons";
import CampaignCard from "@/components/campaigns/CampaignCard";
import BrandHero from "@/components/brand/BrandHero";
import { DollarSign, Users, Flame, PlusCircle, Sparkles } from "lucide-react";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState(null);
  const [user, setUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setUser(me);
      const mine = await base44.entities.Campaign.filter({ created_by_id: me.id }, "-created_date");
      setCampaigns(mine);
    })();
  }, [refreshKey]);

  if (!campaigns) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><CampaignGridSkeleton count={4} /></div>;
  }
