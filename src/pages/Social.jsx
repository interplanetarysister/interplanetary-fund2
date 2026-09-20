import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Radio, Loader2, Link2, RefreshCw, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PostComposer from "@/components/social/PostComposer";
import SocialFeed from "@/components/social/SocialFeed";
import ProfileBanner, { getTierFromScore } from "@/components/social/ProfileBanner";
import ShareToProfileDialog from "@/components/social/ShareToProfileDialog";
import AdminContentPanel from "@/components/social/AdminContentPanel";
import ActivityFeed from "@/components/community/ActivityFeed";
import PageError from "@/components/PageError";

const SAFE_SOCIAL_ERROR = "We couldn't load the social feed. Please try again.";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateRows(value, requiredKeys = []) {
  if (!Array.isArray(value) || value.length > 500) return null;
  const ids = new Set();
  for (const row of value) {
    if (!isRecord(row) || typeof row.id !== "string" || row.id.length === 0 || row.id.length > 200 || ids.has(row.id)) return null;
    if (requiredKeys.some((key) => key in row && row[key] !== null && typeof row[key] !== "string")) return null;
    ids.add(row.id);
  }
  return value;
}

export default function Social() {
  const [user, setUser] = useState(null);
  const [connections, setConnections] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("social");
  const [refreshKey, setRefreshKey] = useState(0);
  const [shareTarget, setShareTarget] = useState(null); // { sourceType, sourceId }
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadUser = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError("");
    try {
      const [u, conns, camps] = await Promise.all([
        base44.auth.me(),
        base44.entities.PlatformConnection.filter({}),
        base44.entities.Campaign.filter({}),
      ]);
      const safeConnections = validateRows(conns, ["platform", "status", "display_name"]);
      const safeCampaigns = validateRows(camps, ["status"]);
      if (!isRecord(u) || !safeConnections || !safeCampaigns) throw new Error("invalid social response");
      if (!mountedRef.current || generation !== generationRef.current) return;
      setUser(u);
      setConnections(safeConnections);
      setCampaigns(safeCampaigns.filter((c) => c.status === "active" || c.status === "draft"));
    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return;
      setUser(null);
      setConnections([]);
      setCampaigns([]);
      setError(SAFE_SOCIAL_ERROR);
    } finally {
      if (mountedRef.current && generation === generationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const handlePosted = (_post, newScore, newTier) => {
    setUser((prev) => ({ ...prev, social_score: newScore, banner_tier: newTier }));
    setRefreshKey((k) => k + 1);
  };

  const handleShared = (_post, newScore, newTier) => {
    setUser((prev) => ({ ...prev, social_score: newScore, banner_tier: newTier }));
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }
  if (error) return <PageError message={error} onRetry={loadUser} />;

  const currentTier = user?.banner_tier || getTierFromScore(user?.social_score || 0);
  const isAdmin = user?.role === "admin";
  // Users see only their own connections; admins see all (server-side authorization remains authoritative).
  const userConnections = connections.filter((c) => c.created_by_id === user?.id);
  const connectedPlatforms = userConnections.filter((c) => c.status === "connected");

  return (
    <div className="min-h-screen deep-space pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6 pt-safe">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center glow-primary">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl text-white">Interplanetary Social</h1>
              <p className="text-slate-400 text-xs">The Interplanetary Fund social universe</p>
            </div>
          </div>
          <button onClick={() => { setRefreshKey((k) => k + 1); loadUser(); }} className="text-slate-400 hover:text-cyan-300">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="social" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200">
              <Radio className="w-3.5 h-3.5 mr-1.5" /> Social
            </TabsTrigger>
            <TabsTrigger value="community" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Community
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            {tab === "social" ? (
              <>
                {user && (
                  <PostComposer user={user} connections={userConnections} campaigns={campaigns} onPosted={handlePosted} />
                )}
                <SocialFeed key={refreshKey} user={user} onShare={(post) => setShareTarget({ sourceType: "social_post", sourceId: post.id })} />
              </>
            ) : (
              <ActivityFeed />
            )}
          </div>

          <div className="space-y-4">
            {user && <ProfileBanner tier={currentTier} socialScore={user.social_score || 0} username={user.username} />}

            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-300 text-sm font-medium">Connected Platforms</p>
                <Link to="/connections" className="text-cyan-300 text-xs hover:underline">Manage</Link>
              </div>
              {connectedPlatforms.length === 0 ? (
                <div className="text-center py-4">
                  <Link2 className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs mb-3">Connect Instagram, TikTok, and more to cross-post.</p>
                  <Link to="/connections" className="text-cyan-300 text-xs font-medium hover:underline">Connect platforms →</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedPlatforms.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {c.display_name || c.platform}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <p className="text-slate-300 text-sm font-medium mb-2">How Rewards Work</p>
              <div className="space-y-1.5 text-xs text-slate-400">
                <p>🪐 10 pts → Bronze banner</p>
                <p>🌙 50 pts → Silver banner</p>
                <p>⭐ 100 pts → Gold + top placement</p>
                <p>🌠 500 pts → Platinum commander</p>
              </div>
            </div>

            {isAdmin && (
              <>
                <AdminContentPanel onGenerated={() => setRefreshKey((k) => k + 1)} />
                <div className="glass-panel rounded-2xl p-4">
                  <p className="text-slate-300 text-sm font-medium mb-2">Admin: All Connections</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {connections.length === 0 ? (
                      <p className="text-xs text-slate-500">No platform connections.</p>
                    ) : (
                      connections.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{c.display_name || c.platform}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            c.status === "connected" ? "bg-emerald-500/20 text-emerald-300" :
                            c.status === "error" ? "bg-rose-500/20 text-rose-300" :
                            "bg-slate-500/20 text-slate-400"
                          }`}>{c.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {shareTarget && (
        <ShareToProfileDialog open={!!shareTarget} onClose={() => setShareTarget(null)} sourceType={shareTarget.sourceType} sourceId={shareTarget.sourceId} user={user} connections={userConnections} onShared={handleShared} />
      )}
    </div>
  );
}
