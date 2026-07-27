import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Megaphone, Loader2 } from "lucide-react";

export default function UpdatesSection({ campaignId, updates, isOwner, onPosted }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const post = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await base44.entities.CampaignUpdate.create({ campaign_id: campaignId, title, content });
    setTitle(""); setContent("");
    setSaving(false);
    onPosted?.();
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Megaphone className="w-4 h-4 text-orange-600" />
        <h3 className="font-display text-xl text-stone-900">Updates</h3>
      </div>
      {isOwner && (
        <div className="space-y-3 mb-6 pb-6 border-b border-stone-100">
          <Input placeholder="Update title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Share progress with your supporters…" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          <Button onClick={post} disabled={saving || !content.trim()} className="bg-stone-900 hover:bg-stone-800 text-white rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post update"}
          </Button>
        </div>
      )}
      {updates.length === 0 ? (
        <p className="text-sm text-stone-400">No updates yet.</p>
      ) : (
        <div className="space-y-5">
          {updates.map((u) => (
            <div key={u.id}>
              <p className="text-xs text-stone-400 mb-1">{format(new Date(u.created_date), "MMM d, yyyy")}</p>
              {u.title && <h4 className="font-semibold text-stone-900 mb-1">{u.title}</h4>}
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{u.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}