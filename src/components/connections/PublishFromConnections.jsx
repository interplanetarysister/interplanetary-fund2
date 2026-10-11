import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Megaphone, ArrowUpRight } from "lucide-react";

// One clear path from Connections to the real campaign distribution editor.
export default function PublishFromConnections() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const owner = await base44.auth.me();
        const rows = await base44.entities.Campaign.filter({ created_by_id: owner.id }, "-created_date", 30);
        if (active) setCampaigns((rows || []).filter((c) => c.created_by_id === owner.id && c.status !== "deleted"));
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section aria-label="Publish to connected accounts" className="mb-7 min-w-0 rounded-2xl border border-cyan-300/40 bg-slate-950 p-4 sm:p-5 text-cyan-50">
      <h2 className="flex items-center gap-2 font-semibold text-lg"><Megaphone className="w-5 h-5" /> Publish to your accounts</h2>
      <p className="text-sm text-slate-200 mt-1">
        Choose your IFund campaign, write or prepare a post, select connected destinations and publish.
        Unsupported destinations get a copy-and-open handoff, never a false “Published” confirmation.
      </p>
      {loading && <p className="text-sm text-slate-200 mt-3">Loading your campaigns…</p>}
      {!loading && error && <p role="alert" className="text-sm text-amber-200 mt-3">Your campaigns could not be loaded. <Link to="/dashboard" className="underline">Open dashboard</Link>.</p>}
      {!loading && !error && !campaigns.length && (
        <Link to="/create" className="inline-flex mt-3 min-h-11 items-center rounded-xl bg-cyan-300 px-4 py-2 text-slate-950 font-semibold">Create a campaign</Link>
      )}
      {!loading && !error && campaigns.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {campaigns.map((c) => (
            <Link key={c.id} to={`/campaign/${encodeURIComponent(c.id)}#campaign-distribution`}
              className="inline-flex min-w-0 min-h-11 items-center justify-between gap-2 rounded-xl border border-cyan-300/40 bg-slate-900 px-3 py-2 text-cyan-50 hover:border-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-200">
              <span className="truncate">{c.title || "Your campaign"}</span><ArrowUpRight className="w-4 h-4 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
