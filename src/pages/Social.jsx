import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Radio, Loader2, Link2, Sparkles, RefreshCw } from "lucide-react";
import PostComposer from "@/components/social/PostComposer";
import PostCard from "@/components/social/PostCard";
import ProfileBanner, { getTierFromScore } from "@/components/social/ProfileBanner";
import PageError from "@/components/PageError";

export default function Social() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, p, conns, camps] = await Promise.all([
        base44.auth.me(),
        base44.entities.SocialPost.list("-created_date", 100),
        base44.entities.PlatformConnection.filter({}).catch(() => []),
        base44.entities.Campaign.filter({}).catch(() => []),
      ]);
      setUser(u);
      setPosts(Array.isArray(p) ? p : []);
      setConnections(Array.isArray(conns) ? conns : []);
      setCampaigns(Array.isArray(camps) ? camps.filter((c) => c.status === "active" || c.status === "draft") : []);
    } catch (err) {
      setError("We couldn't load the social feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll, refreshKey]);

  const handlePosted = (_post, newScore, newTier) => {
    setUser((prev) => ({ ...prev, social_score: newScore, banner_tier: newTier }));
    setRefreshKey((k) => k + 1);
  };

  const handleLike = async (post) => {
    try {
      const updated = await base44.entities.SocialPost.update(post.id, { likes_count: (post.likes_count || 0) + 1 });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes_count: updated.likes_count } : p)));
    } catch { /* best-effort */ }
  };

  const handleDelete = async (post) => {
    try {
      await base44.entities.SocialPost.delete(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch { /* best-effort */ }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }
  if (error) return <PageError message={error} onRetry={() => setRefreshKey((k) => k + 1)} />;

  const topPosts = posts.filter((p) => p.is_top_post);
  const feedPosts = posts.filter((p) => !p.is_top_post);
  const currentTier = user?.banner_tier || getTierFromScore(user?.social_score || 0);
  const connectedPlatforms = connections.filter((c) => c.status === "connected");

  return (
    <div className="min-h-screen deep-space pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6 pt-safe">
        {/* Header */}
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
          <button onClick={() => setRefreshKey((k) => k + 1)} className="text-slate-400 hover:text-cyan-300">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          {/* Main feed */}
          <div className="space-y-4">
            {user && (
              <PostComposer
                user={user}
                connections={connections}
                campaigns={campaigns}
                onPosted={handlePosted}
              />
            )}

            {topPosts.length > 0 && (
              <div>
                <p className="text-cyan-300 text-xs font-medium mb-2 px-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Top Posts
                </p>
                <div className="space-y-3">
                  {topPosts.map((p) => (
                    <PostCard key={p.id} post={p} currentUser={user} onLike={handleLike} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {feedPosts.length === 0 && !topPosts.length ? (
                <div className="glass-panel rounded-2xl p-10 text-center">
                  <Radio className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-300 text-sm">No posts yet. Be the first to broadcast!</p>
                </div>
              ) : (
                feedPosts.map((p) => (
                  <PostCard key={p.id} post={p} currentUser={user} onLike={handleLike} onDelete={handleDelete} />
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {user && (
              <ProfileBanner tier={currentTier} socialScore={user.social_score || 0} username={user.username} />
            )}

            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-300 text-sm font-medium">Connected Platforms</p>
                <Link to="/connections" className="text-cyan-300 text-xs hover:underline">Manage</Link>
              </div>
              {connectedPlatforms.length === 0 ? (
                <div className="text-center py-4">
                  <Link2 className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs mb-3">Connect Instagram, TikTok, and more to cross-post.</p>
                  <Link to="/connections" className="text-cyan-300 text-xs font-medium hover:underline">
                    Connect platforms →
                  </Link>
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
          </div>
        </div>
      </div>
    </div>
  );
}