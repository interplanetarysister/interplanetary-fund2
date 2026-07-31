import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { Progress } from "@/components/ui/progress";

export const categoryLabels = {
  medical: "Medical", emergency: "Emergency", education: "Education", community: "Community",
  animals: "Animals", business: "Business", memorial: "Memorial", disaster_relief: "Disaster Relief",
  creative: "Creative", other: "Other",
};

export default function CampaignCard({ campaign }) {
  const pct = campaign.goal_amount ? Math.min(100, ((campaign.raised_amount || 0) / campaign.goal_amount) * 100) : 0;
  return (
    <Link to={`/campaign/${campaign.id}`} className="group bg-white rounded-2xl border border-stone-200/70 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      <div className="h-40 bg-stone-100 overflow-hidden">
        {campaign.cover_image_url ? (
          <Image src={campaign.cover_image_url} alt={campaign.title} className="w-full h-full group-hover:scale-[1.03] transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-cyan-50 via-sky-50 to-slate-100" />
        )}
      </div>
      <div className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-primary mb-1.5">{categoryLabels[campaign.category] || "Other"}</p>
        <h3 className="font-display text-lg text-stone-900 leading-snug mb-2 line-clamp-2">{campaign.title}</h3>
        <Progress value={pct} className="h-1.5 mb-2.5" />
        <p className="text-sm text-stone-600">
          <span className="font-semibold text-stone-900">${(campaign.raised_amount || 0).toLocaleString()}</span>
          <span className="text-stone-400"> of ${campaign.goal_amount?.toLocaleString()} · {campaign.donor_count || 0} donors</span>
        </p>
      </div>
    </Link>
  );
}