import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Copy, Check, CalendarClock, Trash2, ExternalLink } from "lucide-react";
import { platformName } from "@/components/connections/platformCatalog";

const statusStyles = {
  draft: "bg-stone-100 text-stone-600",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  scheduled: "bg-violet-100 text-violet-700",
  published: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

// One AI-generated platform post: edit, approve & publish (direct API where
// supported, copy-to-post otherwise), schedule, or discard.
export default function DistributedPostCard({ post, onChanged, onRemoved }) {
  const [content, setContent] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [notice, setNotice] = useState("");

  const fullText = [content, ...(post.hashtags || [])].join(" ").trim();

  const saveEdit = async () => {
    if (content === post.content) return;
    onChanged(await base44.entities.DistributedPost.update(post.id, { content }));
  };

  const publish = async () => {
    setBusy(true);
    setNotice("");
    await saveEdit();
    try {
      const { data } = await base44.functions.invoke("publishPost", { post_id: post.id });
      if (data?.error) setNotice(data.error);
      else if (data?.manual) {
        onChanged(data.post);
        setNotice("This platform has no publishing API — the post is approved. Copy it and post it on your account.");
      } else onChanged(data.post);
    } catch (e) {
      setNotice(e.response?.data?.error || "Publishing failed.");
    }
    setBusy(false);
  };

  const schedule = async () => {
    if (!scheduleAt) return;
    setBusy(true);
    await saveEdit();
    onChanged(await base44.entities.DistributedPost.update(post.id, { status: "scheduled", scheduled_for: new Date(scheduleAt).toISOString() }));
    setShowSchedule(false);
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    await base44.entities.DistributedPost.delete(post.id);
    onRemoved(post.id);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold text-stone-900 text-sm">{platformName(post.platform)}</p>
        <Badge className={`${statusStyles[post.status] || ""} border-0 capitalize`}>{post.status.replace("_", " ")}</Badge>
      </div>
      {post.status === "published" ? (
        <p className="text-sm text-stone-600 whitespace-pre-line">{fullText}</p>
      ) : (
        <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} onBlur={saveEdit} className="text-sm" />
      )}
      {post.error && <p className="text-xs text-red-600 mt-1.5">Last error: {post.error} (attempt {post.retry_count || 0}/3)</p>}
      {post.scheduled_for && post.status === "scheduled" && (
        <p className="text-xs text-violet-600 mt-1.5">Scheduled for {new Date(post.scheduled_for).toLocaleString()}</p>
      )}
      {notice && <p className="text-xs text-amber-700 mt-1.5">{notice}</p>}

      <div className="flex flex-wrap gap-2 mt-3">
        {post.status !== "published" && (
          <Button size="sm" onClick={publish} disabled={busy} className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Approve & publish
          </Button>
        )}
        {post.status !== "published" && (
          <Button size="sm" variant="outline" onClick={() => setShowSchedule((v) => !v)} className="rounded-lg">
            <CalendarClock className="w-3.5 h-3.5" /> Schedule
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={copy} className="rounded-lg">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
        </Button>
        {post.external_post_url && (
          <a href={post.external_post_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> View post</Button>
          </a>
        )}
        {post.status !== "published" && (
          <Button size="sm" variant="outline" onClick={remove} disabled={busy} className="rounded-lg text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
        )}
      </div>
      {showSchedule && (
        <div className="flex gap-2 mt-2">
          <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="max-w-56" />
          <Button size="sm" onClick={schedule} disabled={busy || !scheduleAt} className="rounded-lg">Set</Button>
        </div>
      )}
    </div>
  );
}