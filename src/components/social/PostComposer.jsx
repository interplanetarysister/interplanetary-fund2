import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ImagePlus, Send, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getTierFromScore } from "@/components/social/ProfileBanner";
import { useToast } from "@/components/ui/use-toast";

const PLATFORM_LABELS = {
  facebook: "Facebook", instagram: "Instagram", x: "X", tiktok: "TikTok",
  youtube: "YouTube", discord: "Discord", bluesky: "Bluesky", mastodon: "Mastodon",
  linkedin: "LinkedIn", threads: "Threads", reddit: "Reddit", pinterest: "Pinterest",
};

export default function PostComposer({ user, connections, campaigns, onPosted }) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [crossPost, setCrossPost] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          "Generate a short, inspiring social media post (under 280 characters) for the Interplanetary Fund — a universal fundraising operating system where one campaign reaches all platforms. Be cosmic, empowering, and community-focused. No hashtags, no emojis beyond one.",
        response_json_schema: { type: "object", properties: { post_text: { type: "string" } } },
      });
      if (res?.post_text) {
        setContent(res.post_text);
        setAiGenerated(true);
      }
    } catch {
      toast({ title: "AI generation failed", description: "Try writing your own post.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setMediaUrl(file_url);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const toggleCrossPost = (platform) => {
    setCrossPost((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const newScore = (user.social_score || 0) + 10;
      const newTier = getTierFromScore(newScore);
      const campaign = campaigns?.find((c) => c.id === selectedCampaign);

      const post = await base44.entities.SocialPost.create({
        author_user_id: user.id,
        author_username: user.username || user.full_name,
        author_name: user.full_name,
        author_banner_tier: newTier,
        content: content.trim(),
        media_url: mediaUrl || undefined,
        campaign_id: campaign?.id || undefined,
        campaign_title: campaign?.title,
        is_top_post: newTier === "gold" || newTier === "platinum",
        crosspost_platforms: crossPost,
        ai_generated: aiGenerated,
      });

      await base44.auth.updateMe({ social_score: newScore, banner_tier: newTier });

      // Cross-post to linked external platforms where a campaign is linked.
      if (campaign && crossPost.length > 0) {
        for (const platform of crossPost) {
          const conn = connections?.find((c) => c.platform === platform && c.status === "connected");
          if (!conn) continue;
          try {
            const dp = await base44.entities.DistributedPost.create({
              campaign_id: campaign.id,
              campaign_title: campaign.title,
              connection_id: conn.id,
              platform,
              content: content.trim(),
              status: "pending_approval",
            });
            await base44.functions.invoke("publishPost", { post_id: dp.id });
          } catch {
            // Cross-post failure doesn't block the native post.
          }
        }
      }

      setContent("");
      setMediaUrl("");
      setAiGenerated(false);
      setCrossPost([]);
      setSelectedCampaign("");
      toast({ title: "Posted!", description: newTier !== (user.banner_tier || "none") ? `You reached ${newTier} tier!` : "+10 social points" });
      onPosted?.(post, newScore, newTier);
    } catch {
      toast({ title: "Couldn't post", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
          {(user?.full_name || "?")[0]?.toUpperCase()}
        </div>
        <textarea
          placeholder="Share your mission with the universe..."
          value={content}
          onChange={(e) => { setContent(e.target.value); setAiGenerated(false); }}
          rows={2}
          className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 text-sm resize-none focus:outline-none border-none p-1"
        />
      </div>

      {mediaUrl && (
        <div className="relative mb-3 rounded-xl overflow-hidden border border-white/10">
          <img src={mediaUrl} alt="upload" className="w-full max-h-64 object-cover" />
          <button onClick={() => setMediaUrl("")} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {campaigns?.length > 0 && (
        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="w-full mb-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        >
          <option value="">No campaign linked</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id} className="bg-slate-900">{c.title}</option>
          ))}
        </select>
      )}

      {connections?.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-slate-500 text-xs">Cross-post:</span>
          {connections.filter((c) => c.status === "connected").map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCrossPost(c.platform)}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                crossPost.includes(c.platform)
                  ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              {PLATFORM_LABELS[c.platform] || c.platform}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-slate-400 hover:text-cyan-300">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleAI} disabled={aiLoading} className="text-slate-400 hover:text-violet-300">
          {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        </Button>
        <Button onClick={handlePost} disabled={loading || !content.trim()} className="ml-auto bg-gradient-to-r from-cyan-400 to-violet-500 text-white border-none">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="text-sm font-medium">Post</span>
        </Button>
      </div>
    </div>
  );
}