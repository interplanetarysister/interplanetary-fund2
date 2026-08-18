import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Users, BarChart3, CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const STATUS_STYLE = {
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-cyan-100 text-cyan-700 border-cyan-200",
  draft: "bg-stone-100 text-stone-600 border-stone-200",
};

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Facebook Outreach — shows Facebook platform connections and cross-posts.
// In fund2, Facebook outreach is tracked through PlatformConnection (facebook)
// and DistributedPost (platform: facebook) entities.
export default function FacebookGroups() {
  const [connections, setConnections] = useState([]);
  const [posts, setPosts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState("");

  const load = async () => {
    const [conn, p, c] = await Promise.all([
      base44.entities.PlatformConnection.filter({ platform: "facebook" }),
      base44.entities.DistributedPost.filter({ platform: "facebook" }),
      base44.entities.Campaign.list("-raised_amount", 100),
    ]);
    setConnections(conn || []);
    setPosts(p || []);
    setCampaigns(c || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredPosts = selectedCampaign
    ? posts.filter((p) => p.campaign_id === selectedCampaign)
    : posts;

  const published = filteredPosts.filter((p) => p.status === "published").length;
  const failed = filteredPosts.filter((p) => p.status === "failed").length;
  const pending = filteredPosts.filter((p) => ["draft", "pending_approval", "approved", "scheduled"].includes(p.status)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <span className="text-white text-lg font-bold">f</span>
          </div>
          <div>
            <h1 className="font-display text-2xl text-stone-900">Facebook Outreach</h1>
            <p className="text-sm text-stone-500">Connections and cross-posts to Facebook pages and groups.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="shrink-0 text-stone-500">
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Connections" value={connections.length} accent="text-blue-600" />
        <StatCard label="Published" value={published} accent="text-emerald-600" />
        <StatCard label="Pending" value={pending} accent="text-amber-600" />
        <StatCard label="Failed" value={failed} accent="text-rose-600" />
      </div>

      {/* Facebook Connections */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-stone-900 flex items-center gap-2">
            <Users className="w-4 h-4" /> Facebook Connections
          </h2>
          <Link to="/connections">
            <Button size="sm" variant="ghost" className="text-xs text-primary">
              Manage connections →
            </Button>
          </Link>
        </div>

        {connections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center">
            <p className="text-stone-500 text-sm mb-3">No Facebook accounts connected yet.</p>
            <Link to="/connections">
              <Button size="sm" className="rounded-xl bg-blue-600 text-white border-0 hover:bg-blue-700">
                Connect Facebook
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">f</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 text-sm truncate">{c.display_name || c.platform}</p>
                  {c.external_url && (
                    <a href={c.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                      <ExternalLink className="w-3 h-3" /> {c.external_url}
                    </a>
                  )}
                </div>
                <Badge variant="outline" className={`text-[10px] ${c.status === "connected" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-stone-100 text-stone-500"}`}>
                  {c.status || "unknown"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cross-posts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-stone-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Cross-Posts
          </h2>
          {campaigns.length > 0 && (
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="text-xs rounded-xl border border-stone-200 px-3 py-1.5 text-stone-700 bg-white outline-none"
            >
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          )}
        </div>

        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-400 text-sm">
            No Facebook posts yet. The AI Distribution Engine will post here when a campaign update is cross-posted to Facebook.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPosts.slice(0, 30).map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-stone-200/70 p-3 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {p.status === "published" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {p.status === "failed" && <XCircle className="w-4 h-4 text-rose-500" />}
                  {["draft","pending_approval","approved","scheduled"].includes(p.status) && <Clock className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700 line-clamp-2">{p.content || "(no content)"}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-[11px] text-stone-400">{p.campaign_title}</p>
                    {p.published_at && <p className="text-[11px] text-stone-400">{fmtDate(p.published_at)}</p>}
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_STYLE[p.status] || ""}`}>
                  {(p.status || "").replace("_", " ")}
                </Badge>
              </div>
            ))}
            {filteredPosts.length > 30 && (
              <p className="text-xs text-stone-400 text-center pt-1">Showing 30 of {filteredPosts.length} posts.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
      <p className="text-xs text-stone-500 uppercase tracking-wide">{label}</p>
      <p className={`font-display text-2xl ${accent}`}>{value}</p>
    </div>
  );
}
