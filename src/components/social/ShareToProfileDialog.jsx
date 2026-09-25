import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, Check, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { getTierFromScore } from "@/components/social/ProfileBanner";
import { isUsableConnection } from "@/lib/connectionHealth";

const PLATFORM_LABELS = {
  facebook: "Facebook", instagram: "Instagram", x: "X", tiktok: "TikTok",
  youtube: "YouTube", discord: "Discord", bluesky: "Bluesky", mastodon: "Mastodon",
  linkedin: "LinkedIn", threads: "Threads", reddit: "Reddit",
};

// Share-to-Profile flow: user clicks "Share", an AI agent drafts a post, the
// user reviews and approves, and it's posted to their feed + cross-posted to
// their connected external accounts.
export default function ShareToProfileDialog({ open, onClose, sourceType, sourceId, user, connections, onShared }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [crossPost, setCrossPost] = useState([]);

  useEffect(() => {
    if (!open || !sourceType || !sourceId) return;
    setLoading(true);
    setDraft("");
    setCrossPost([]);
    base44.functions
      .invoke("draftSharePost", { source_type: sourceType, source_id: sourceId })
      .then((res) => {
        setDraft(res?.data?.draft_text || "");
        setSourceTitle(res?.data?.source_title || "");
      })
      .catch(() => toast({ title: "Couldn't draft post", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, sourceType, sourceId]);

  const connectedSocial = (connections || []).filter((c) => isUsableConnection(c) && c.kind === "social");
  const campaignId = sourceType === "campaign" ? sourceId : undefined;

  const handleShare = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const newScore = (user?.social_score || 0) + 10;
      const newTier = getTierFromScore(newScore);
      const post = await base44.entities.SocialPost.create({
        author_user_id: user.id,
        author_username: user.username || user.full_name,
        author_name: user.full_name,
        author_banner_tier: newTier,
        content: draft.trim(),
        campaign_id: campaignId,
        is_top_post: newTier === "gold" || newTier === "platinum",
        crosspost_platforms: crossPost,
        ai_generated: true,
      });
      await base44.auth.updateMe({ social_score: newScore, banner_tier: newTier });

      // Cross-post to linked external platforms
      if (crossPost.length > 0) {
        for (const platform of crossPost) {
          const conn = connectedSocial.find((c) => c.platform === platform);
          if (!conn || !campaignId) continue;
          try {
            const dp = await base44.entities.DistributedPost.create({
              campaign_id: campaignId,
              connection_id: conn.id,
              platform,
              content: draft.trim(),
              status: "pending_approval",
            });
            await base44.functions.invoke("publishPost", { post_id: dp.id });
          } catch { /* best-effort */ }
        }
      }

      toast({ title: "Shared to your profile!", description: newTier !== (user?.banner_tier || "none") ? `You reached ${newTier} tier!` : "+10 social points" });
      onShared?.(post, newScore, newTier);
      onClose();
    } catch {
      toast({ title: "Couldn't share", variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-white/10 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-4 h-4 text-violet-400" /> Share to Your Profile
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="ml-2 text-sm text-slate-400">AI agent drafting your post…</span>
          </div>
        ) : (
          <>
            {sourceTitle && <p className="text-xs text-slate-500 mb-2">Source: {sourceTitle}</p>}
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className="bg-white/5 border-white/10 text-slate-100 resize-none"
              placeholder="Your AI-drafted post will appear here…"
            />

            {connectedSocial.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Cross-post to your connected accounts:
                </p>
                <div className="flex flex-wrap gap-2">
                  {connectedSocial.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCrossPost((prev) => prev.includes(c.platform) ? prev.filter((p) => p !== c.platform) : [...prev, c.platform])}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                        crossPost.includes(c.platform)
                          ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200"
                          : "bg-white/5 border-white/10 text-slate-400"
                      }`}
                    >
                      {crossPost.includes(c.platform) && <Check className="w-3 h-3 inline mr-1" />}
                      {PLATFORM_LABELS[c.platform] || c.platform}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {connectedSocial.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Connect social accounts in <a href="/connections" className="text-cyan-400 hover:underline">Connections</a> to enable cross-posting.
              </p>
            )}

            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancel</Button>
              <Button onClick={handleShare} disabled={posting || !draft.trim()} className="bg-gradient-to-r from-cyan-400 to-violet-500 text-white border-none">
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Approve & Share
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}