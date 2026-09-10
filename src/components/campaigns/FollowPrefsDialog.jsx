import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PREFS = [
  { key: "updates", label: "New campaign updates" }, { key: "media", label: "New media uploads" }, { key: "milestones", label: "Milestone achievements" }, { key: "goal_reached", label: "Goal reached" }, { key: "nearing_completion", label: "Nearing completion" }, { key: "comments", label: "New comments" }, { key: "volunteer", label: "Volunteer opportunities" }, { key: "events", label: "Event announcements" }, { key: "emergencies", label: "Fundraising emergencies" }, { key: "completed", label: "Campaign completed" },
];

export default function FollowPrefsDialog({ follow, onChanged, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(follow?.notification_prefs || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => { if (!open) setPrefs(follow?.notification_prefs || {}); }, [follow, open]);

  const save = async () => {
    if (saving || disabled || !follow?.id) return;
    setSaving(true); setError(null);
    try {
      const updated = await base44.entities.FollowedCampaign.update(follow.id, { notification_prefs: prefs });
      onChanged(updated);
      setOpen(false);
      toast({ title: "Notification preferences saved" });
    } catch {
      setError("We couldn't save notification preferences. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving && !disabled) setOpen(next); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline" disabled={disabled} className="rounded-lg"><Bell className="w-3.5 h-3.5" /> Notifications</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Notification preferences</DialogTitle></DialogHeader>
        <p className="text-sm text-stone-500 -mt-1">Choose which alerts you receive for “{follow?.campaign_title}”.</p>
        {error && <div role="alert" className="text-sm text-red-700">{error}</div>}
        <div className="space-y-3 mt-2 max-h-[50vh] overflow-y-auto">{PREFS.map((p) => <div key={p.key} className="flex items-center justify-between"><span className="text-sm text-stone-700">{p.label}</span><Switch checked={prefs[p.key] !== false} disabled={saving} onCheckedChange={(v) => setPrefs((prev) => ({ ...prev, [p.key]: v }))} /></div>)}</div>
        <DialogFooter><Button onClick={save} disabled={saving || disabled} className="rounded-xl">{saving ? "Saving…" : "Save preferences"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}