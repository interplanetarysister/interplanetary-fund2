import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "@/components/ui/image";
import MediaUpload from "@/components/media/MediaUpload";
import { format } from "date-fns";
import { Megaphone, Loader2 } from "lucide-react";

const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function UpdatesSection({ campaignId, updates, isOwner, onPosted }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const post = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await base44.entities.CampaignUpdate.create({
      campaign_id: campaignId,
      title,
      content,
      media_url: mediaUrl || undefined,
      media_type: mediaUrl ? (isVideo(mediaUrl) ? "video" : "image") : "none",
    });
    setTitle(""); setContent(""); setMediaUrl("");
    setSaving(false);
    onPosted?.();
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Megaphone className="w-4 h-4 text-primary" />
        <h3 className="font-display text-xl text-stone-900">Updates</h3>
      </div>
      {isOwner && (
        <div className="space-y-3 mb-6 pb-6 border-b border-stone-100">
          <Input placeholder="Update title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Share progress with your supporters…" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          <MediaUpload
            value={mediaUrl}
            onChange={setMediaUrl}
            label="Attach a photo or video"
            previewClassName="w-full h-40 rounded-xl object-cover"
          />
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
              {u.media_url && (isVideo(u.media_url) ? (
                <video src={u.media_url} controls className="w-full max-h-80 rounded-xl mb-3" />
              ) : (
                <Image src={u.media_url} alt={u.title || "Update media"} className="w-full max-h-80 rounded-xl object-cover mb-3" />
              ))}
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{u.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}