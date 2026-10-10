import React from "react";
import { Link } from "react-router-dom";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { splitCampaignContent } from "@/lib/campaignEmbed";

export default function CampaignEmbeddedText({ body, campaigns = [] }) {
  const byId = new Map((campaigns||[]).map(c=>[c.id,c]));
  return <div className="space-y-4">
    {splitCampaignContent(body).map((block,index)=>block.type==="text"?
      <div key={index} className="whitespace-pre-wrap break-words text-sm leading-7 text-stone-700">{block.value}</div>:
      <div key={index} className="max-w-sm">
        {byId.get(block.id) ? <CampaignCard campaign={byId.get(block.id)}/> :
          <Link className="text-cyan-700 underline text-sm" to={`/campaign/${block.id}`}>View campaign on IFund</Link>}
      </div>)}
  </div>;
}
