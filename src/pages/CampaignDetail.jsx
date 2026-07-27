import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import DonateDialog from "@/components/campaigns/DonateDialog";
import CampaignHealth from "@/components/campaigns/CampaignHealth";
import AICoach from "@/components/campaigns/AICoach";
import UpdatesSection from "@/components/campaigns/UpdatesSection";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import { format } from "date-fns";
import { Loader2, Users, CalendarDays } from "lucide-react";

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [donations, setDonations] = useState([]);
  const [user, setUser] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const [c, u, d] = await Promise.all([
      base44.entities.Campaign.filter({ id }),
      base44.entities.CampaignUpdate.filter({ campaign_id: id }, "-created_date"),
      base44.entities.Donation.filter({ campaign_id: id }, "-created_date", 10),
    ]);
    if (!c.length) { setNotFound(true); return; }
    setCampaign(c[0]);
    setUpdates(u);
    setDonations(d);
  }, [id]);

  useEffect(() => {
    load();
    base44.auth.me().then(setUser).catch(() => {});
  }, [load]);

  if (notFound) return <div className="text-center py-24 text-stone-500">Campaign not found.</div>;
  if (!campaign) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-orange-600" /></div>;

  const isOwner = user && campaign.created_by_id === user.id;
  const pct = Math.min(100, ((campaign.raised_amount || 0) / campaign.goal_amount) * 100);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {campaign.cover_image_url && (
            <Image src={campaign.cover_image_url} alt={campaign.title} className="w-full h-56 sm:h-80 rounded-2xl" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">{categoryLabels[campaign.category] || "Other"}</Badge>
              {campaign.status !== "active" && <Badge variant="outline" className="capitalize">{campaign.status}</Badge>}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-stone-900 leading-tight">{campaign.title}</h1>
            {campaign.summary && <p className="text-stone-600 mt-2 text-lg">{campaign.summary}</p>}
          </div>
          {campaign.story && (
            <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
              <h3 className="font-display text-xl text-stone-900 mb-3">The story</h3>
              <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{campaign.story}</p>
            </div>
          )}
          <UpdatesSection campaignId={campaign.id} updates={updates} isOwner={isOwner} onPosted={load} />
        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-8 self-start">
          <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
            <p className="font-display text-3xl text-stone-900">${(campaign.raised_amount || 0).toLocaleString()}</p>
            <p className="text-sm text-stone-500 mb-3">raised of ${campaign.goal_amount.toLocaleString()} goal</p>
            <Progress value={pct} className="h-2 mb-4" />
            <div className="flex items-center gap-4 text-sm text-stone-500 mb-5">
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{campaign.donor_count || 0} donors</span>
              {campaign.end_date && <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />Ends {format(new Date(campaign.end_date), "MMM d")}</span>}
            </div>
            <DonateDialog campaign={campaign} onDonated={load} />
          </div>

          {donations.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
              <h3 className="font-display text-lg text-stone-900 mb-3">Recent supporters</h3>
              <ul className="space-y-3">
                {donations.map((d) => (
                  <li key={d.id} className="text-sm">
                    <p className="text-stone-800"><span className="font-medium">{d.donor_name || "Anonymous"}</span> · <span className="text-orange-600 font-semibold">${d.amount.toLocaleString()}</span>{d.is_recurring && <span className="text-stone-400 text-xs"> /mo</span>}</p>
                    {d.message && <p className="text-stone-500 text-xs mt-0.5">"{d.message}"</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOwner && <CampaignHealth campaign={campaign} updatesCount={updates.length} />}
          {isOwner && <AICoach campaign={campaign} updatesCount={updates.length} />}
        </div>
      </div>
    </div>
  );
}