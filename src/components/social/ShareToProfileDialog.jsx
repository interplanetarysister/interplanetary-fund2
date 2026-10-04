import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, Check, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { isUsableConnection } from "@/lib/connectionHealth";
import ExternalPublishingResults from "@/components/social/ExternalPublishingResults";

const PLATFORM_LABELS = {
  facebook: "Facebook", instagram: "Instagram", x: "X", tiktok: "TikTok",
  youtube: "YouTube", discord: "Discord", bluesky: "Bluesky", mastodon: "Mastodon",
  linkedin: "LinkedIn", threads: "Threads", reddit: "Reddit",
};

// Share-to-Profile flow: user clicks "Share", an AI agent drafts a post, the
// user reviews and approves, and it's posted to their feed + cross-posted to
// their connected external accounts.
export default function ShareToProfileDialog({ open, onClose, sourceType, sourceId, user, connections, providerCapabilities = [], onShared }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [crossPost, setCrossPost] = useState([]);
  const [externalResults, setExternalResults] = useState([]);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!open || !sourceType || !sourceId) return;
    setLoading(true);
    setDraft("");
    setCrossPost([]);
    setExternalResults([]);
    setShared(false);
    base44.functions
      .invoke("draftSharePost", { source_type: sourceType, source_id: sourceId })
      .then((res) => {
        setDraft(res?.data?.draft_text || "");
        setSourceTitle(res?.data?.source_title || "");
      })
      .catch(() => toast({ title: "Couldn't draft post", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open, sourceType, sourceId]);

  const capabilityFor = (platform) => providerCapabilities.find((c) => String(c.platform).toLowerCase() === String(platform).toLowerCase());
  const connectedSocial = (connections || []).filter((c) => {
    if (!isUsableConnection(c) || c.kind !== "social") return false;
    const cap = capabilityFor(c.platform);
    return cap?.direct_publish_eligible === true || cap?.manual_share_eligible === true;
  });
  const campaignId = sourceType === "campaign" ? sourceId : undefined;

  const handleShare = async () => {
    if (shared) {
      onClose();
      return;
    }
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const { data } = await base44.functions.invoke("createSocialPost", {
        content: draft.trim(), campaign_id: campaignId, crosspost_platforms: crossPost, ai_generated: true,
      });
      if (data?.ok !== true || !data?.post) throw new Error("Social share creation rejected");
      const post = data.post;
      const newScore = data.social_score;
      const newTier = data.banner_tier;

      // Cross-post to linked external platforms
      const results = [];
      if (campaignId && crossPost.length > 0) {
        for (const platform of crossPost) {
          const conn = connectedSocial.find((c) => c.platform === platform);
          const label = PLATFORM_LABELS[platform] || platform;
          if (!conn) {
            results.push({ platform, label, status: "failed", reason: "The selected connection is no longer available." });
            continue;
          }
          try {
            const { data: distributed } = await base44.functions.invoke("createDistributedPost", { campaign_id: campaignId, connection_id: conn.id, content: draft.trim() });
            if (distributed?.ok !== true || !distributed?.post?.id) throw new Error("Distributed post creation rejected");
            const dp = distributed.post;
            const { data: outcome } = await base44.functions.invoke("publishPost", { post_id: dp.id });
            if (outcome?.manual && outcome?.verified_manual === true) {
              results.push({ platform, label, status: "manual", reason: outcome.reason || "Copy the post and finish sharing on the platform.", profile_url: outcome.profile_url || "", manual_share_method: outcome.manual_share_method || "" });
            } else if (outcome?.manual) {
              results.push({ platform, label, status: "failed", reason: outcome.reason || "No verified publishing path is available." });
            } else if (outcome?.post?.status === "published") {
              results.push({ platform, label, status: "published" });
            } else {
              results.push({ platform, label, status: "failed", reason: "Publishing was not confirmed." });
            }
          } catch {
            results.push({ platform, label, status: "failed", reason: "Publishing failed safely. Check the connection and try again." });
          }
        }
      }

      const needsAttention = results.some((result) => result.status !== "published");
      setExternalResults(results);
      setShared(true);
      toast({ title: "Shared to your Interplanetary profile", description: needsAttention ? "Review the external publishing results before closing." : newTier !== (user?.banner_tier || "none") ? `You reached ${newTier} tier!` : "+10 social points" });
      onShared?.(post, newScore, newTier);
      if (!needsAttention) onClose();
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

            {campaignId && connectedSocial.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Publish to:
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

            {campaignId && connectedSocial.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">
                No connected platforms have a verified sharing path yet. <a href="/connections" className="text-cyan-400 hover:underline">Manage connections</a>
              </p>
            )}

            {campaignId && crossPost.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-2">Selecting Publish authorizes this post to the selected destinations.</p>
            )}

            <ExternalPublishingResults results={externalResults} content={draft.trim()} />

            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancel</Button>
              <Button onClick={handleShare} disabled={posting || (!shared && !draft.trim())} className="bg-gradient-to-r from-cyan-400 to-violet-500 text-white border-none">
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {shared ? "Done" : "Publish"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
