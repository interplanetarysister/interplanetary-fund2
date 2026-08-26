import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Badge } from "@/components/ui/badge";
import DonateDialog from "@/components/campaigns/DonateDialog";
import CampaignFundingCard from "@/components/campaigns/CampaignFundingCard";
import ShareCampaignKit from "@/components/campaigns/ShareCampaignKit";
import CrossPlatformTotals from "@/components/campaigns/CrossPlatformTotals";
import CashAppSettings from "@/components/campaigns/CashAppSettings";
import CampaignHealth from "@/components/campaigns/CampaignHealth";
import AICoach from "@/components/campaigns/AICoach";
import UpdatesSection from "@/components/campaigns/UpdatesSection";
import EditAIInstructionsDialog from "@/components/campaigns/EditAIInstructionsDialog";
import OutreachAgentPanel from "@/components/campaigns/OutreachAgentPanel";
import DistributionPanel from "@/components/distribution/DistributionPanel";
import FollowButton from "@/components/campaigns/FollowButton";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { Loader2, Heart, MapPin } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";

const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [donations, setDonations] = useState([]);
  const [user, setUser] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [related, setRelated] = useState([]);

  const load = useCallback(async () => {
    const [c, u] = await Promise.all([
      base44.entities.Campaign.filter({ id }),
      base44.entities.CampaignUpdate.filter({ campaign_id: id }, "-created_date"),
    ]);
    if (!c.length) { setNotFound(true); return; }

    const donationResponse = await base44.functions.invoke("getCampaignDonationView", {
      campaign_id: id,
      limit: 10,
    });
    if (donationResponse.data?.error) throw new Error(donationResponse.data.error);

    setCampaign(c[0]);
    setUpdates(u);
    setDonations(donationResponse.data?.donations || []);
    const rel = await base44.entities.Campaign.filter({ category: c[0].category, status: "active" }, "-raised_amount", 6);
    setRelated(rel.filter((r) => r.id !== id).slice(0, 3));
  }, [id]);

  useEffect(() => {
    load();
    base44.auth.me().then(setUser).catch(() => {});
  }, [load]);

  if (notFound) return <div className="text-center py-24 text-stone-500">Campaign not found.</div>;
  if (!campaign) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const isOwner = user && campaign.created_by_id === user.id;
  const justDonated = new URLSearchParams(window.location.search).get("donation") === "success";

  return (
    <PullToRefresh onRefresh={load} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {justDonated && (
        <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          Thank you for your donation! It may take a moment to appear on the campaign.
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {isVideo(campaign.cover_image_url) ? (
            <video src={campaign.cover_image_url} controls className="w-full aspect-video object-cover rounded-2xl bg-black" />
          ) : (
            <Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={campaign.title} className="w-full aspect-video object-cover rounded-2xl" />
          )}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge>{categoryLabels[campaign.category] || campaign.category}</Badge>
              {campaign.status && <Badge variant="outline">{campaign.status}</Badge>}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-stone-900">{campaign.title}</h1>
            {campaign.city && <div className="flex items-center gap-1.5 text-stone-500 mt-2 text-sm"><MapPin className="w-4 h-4" />{campaign.city}</div>}
          </div>
          <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{campaign.description}</p>
          <CampaignFundingCard campaign={campaign} donations={donations} />
          <UpdatesSection campaignId={id} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <button onClick={() => setDonateOpen(true)} className="w-full rounded-2xl bg-emerald-600 text-white py-3 font-semibold flex items-center justify-center gap-2"><Heart className="w-5 h-5" />Donate</button>
          <ShareCampaignKit campaign={campaign} />
          <CrossPlatformTotals campaign={campaign} />
          {isOwner && <CashAppSettings campaign={campaign} />}
          {isOwner && <CampaignHealth campaign={campaign} />}
          {isOwner && <AICoach campaign={campaign} />}
          {isOwner && <EditAIInstructionsDialog campaign={campaign} />}
          {isOwner && <OutreachAgentPanel campaign={campaign} />}
          {isOwner && <DistributionPanel campaign={campaign} />}
          <FollowButton campaignId={id} />
          {donations.length > 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-lg text-stone-900 mb-3">Recent supporters</h2>
              <div className="space-y-3">
                {donations.map((donation) => (
                  <div key={donation.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-stone-800 truncate">{donation.donor_name || "Anonymous"}</div>
                      {donation.message && <div className="text-stone-500 truncate">{donation.message}</div>}
                    </div>
                    <span className="font-semibold text-emerald-700">${Number(donation.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <DonateDialog open={donateOpen} onOpenChange={setDonateOpen} campaign={campaign} />
    </PullToRefresh>
  );
}
