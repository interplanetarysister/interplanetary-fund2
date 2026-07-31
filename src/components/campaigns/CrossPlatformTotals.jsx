import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Globe2 } from "lucide-react";
import { Link } from "react-router-dom";
import { platformName } from "@/components/connections/platformCatalog";

// Universal campaign synchronization — the combined fundraising picture across
// Interplanetary Fund and every connected external platform. Owner-only view.
export default function CrossPlatformTotals({ campaign }) {
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    base44.entities.PlatformConnection
      .filter({ campaign_id: campaign.id, kind: "crowdfunding" })
      .then(setConnections)
      .catch(() => {});
  }, [campaign.id]);

  if (!connections.length) return null;

  const ifRaised = campaign.raised_amount || 0;
  const externalRaised = connections.reduce((s, c) => s + (c.external_total || 0), 0);
  const totalDonors = (campaign.donor_count || 0) + connections.reduce((s, c) => s + (c.external_donor_count || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-3">
        <Globe2 className="w-4 h-4 text-primary" /> All platforms combined
      </h3>
      <p className="font-display text-3xl text-stone-900">${(ifRaised + externalRaised).toLocaleString()}</p>
      <p className="text-xs text-stone-500 mb-3">{totalDonors} donors across every destination</p>
      <ul className="space-y-2 text-sm">
        <li className="flex justify-between text-stone-700">
          <span>Interplanetary Fund</span>
          <span className="font-semibold text-primary">${ifRaised.toLocaleString()}</span>
        </li>
        {connections.map((c) => (
          <li key={c.id} className="flex justify-between text-stone-700">
            <span>{platformName(c.platform)}</span>
            <span className="font-semibold">${(c.external_total || 0).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <Link to="/connections" className="block text-xs text-primary hover:text-primary/80 mt-3">Manage connections →</Link>
    </div>
  );
}