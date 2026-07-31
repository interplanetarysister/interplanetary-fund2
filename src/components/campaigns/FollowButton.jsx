import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Persistent follow heart. Tapping saves the campaign to the user's
// Followed Campaigns collection, animates the heart fill, and toasts a
// confirmation. State is DB-backed so it syncs across devices automatically.
export default function FollowButton({ campaign }) {
  const [follow, setFollow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!me) { setLoading(false); return; }
        const existing = await base44.entities.FollowedCampaign.filter({ user_id: me.id, campaign_id: campaign.id });
        setFollow(existing[0] || null);
      } catch { /* not logged in */ }
      setLoading(false);
    })();
  }, [campaign.id]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (follow) {
        await base44.entities.FollowedCampaign.delete(follow.id);
        setFollow(null);
        toast({ title: "Removed from Followed" });
      } else {
        const me = await base44.auth.me();
        if (!me) { base44.auth.redirectToLogin(window.location.pathname); return; }
        const created = await base44.entities.FollowedCampaign.create({
          user_id: me.id,
          campaign_id: campaign.id,
          campaign_title: campaign.title,
          category: campaign.category,
          cover_image_url: campaign.cover_image_url,
          notification_prefs: {
            updates: true, media: true, milestones: true, goal_reached: true,
            nearing_completion: true, comments: false, volunteer: true,
            events: true, emergencies: true, completed: true,
          },
        });
        setFollow(created);
        toast({ title: "Campaign Added to Followed", description: "You'll get updates in your Follow Feed." });
      }
    } catch (e) {
      toast({ title: "Couldn't update follow", variant: "destructive" });
    }
    setBusy(false);
  };

  if (loading) return <div className="w-10 h-10 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-stone-300" /></div>;

  const active = !!follow;
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? "Unfollow campaign" : "Follow campaign"}
      className="relative w-10 h-10 shrink-0 rounded-full bg-white border border-stone-200 flex items-center justify-center hover:border-rose-200 transition-colors disabled:opacity-50"
    >
      <motion.span
        initial={false}
        animate={{ scale: active ? [1, 1.35, 1] : 1 }}
        transition={{ duration: 0.35 }}
        key={active ? "on" : "off"}
      >
        <Heart className={`w-5 h-5 transition-colors ${active ? "text-rose-500 fill-rose-500" : "text-stone-400"}`} />
      </motion.span>
    </button>
  );
}