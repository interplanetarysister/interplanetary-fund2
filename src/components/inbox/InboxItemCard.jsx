import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, ExternalLink, Sparkles, Loader2, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { platformName } from "@/components/connections/platformCatalog";

const typeColors = {
  donation: "bg-emerald-100 text-emerald-700",
  comment: "bg-blue-100 text-blue-700",
  message: "bg-violet-100 text-violet-700",
  mention: "bg-cyan-100 text-cyan-700",
  reply: "bg-blue-100 text-blue-700",
  question: "bg-amber-100 text-amber-700",
  system: "bg-stone-100 text-stone-600",
};

// One inbox item: source, content, deep link to the original conversation,
// AI draft response for review, and mark-complete.
export default function InboxItemCard({ item, onChanged }) {
  const [draft, setDraft] = useState(item.ai_draft || "");
  const [drafting, setDrafting] = useState(false);
  const [showDraft, setShowDraft] = useState(!!item.ai_draft);
  const [copied, setCopied] = useState(false);

  const generateDraft = async () => {
    setDrafting(true);
    setShowDraft(true);
    const text = await base44.integrations.Core.InvokeLLM({
      prompt: `Write a short, warm, genuine reply (under 80 words, no placeholders, no fabricated facts) from a fundraising campaign owner to this ${item.type} received on ${platformName(item.platform)}:
From: ${item.author || "a supporter"}
Message: ${item.content || ""}
${item.campaign_title ? `Campaign: ${item.campaign_title}` : ""}
Return only the reply text.`,
    });
    setDraft(text);
    if (item.record_id) await base44.entities.InboxItem.update(item.record_id, { ai_draft: text });
    setDrafting(false);
  };

  const markDone = async () => {
    if (item.record_id) await base44.entities.InboxItem.update(item.record_id, { status: "done" });
    else if (item.notification_id) await base44.entities.Notification.update(item.notification_id, { read: true });
    onChanged({ ...item, status: "done" });
  };

  const copyDraft = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 ${item.status === "done" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{platformName(item.platform)}</Badge>
            <Badge className={`${typeColors[item.type] || typeColors.system} border-0 capitalize`}>{item.type}</Badge>
            {item.campaign_title && <span className="text-xs text-stone-400 truncate">{item.campaign_title}</span>}
          </div>
          <p className="text-sm text-stone-800 mt-2">
            {item.author && <span className="font-semibold">{item.author}: </span>}
            {item.content}
          </p>
          <p className="text-xs text-stone-400 mt-1">{item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true }) : ""}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {item.status !== "done" && (
          <Button size="sm" variant="outline" onClick={markDone} className="rounded-lg"><Check className="w-3.5 h-3.5" /> Done</Button>
        )}
        <Button size="sm" variant="outline" onClick={generateDraft} disabled={drafting} className="rounded-lg text-primary">
          {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI draft reply
        </Button>
        {item.link && (
          <a href={item.link.startsWith("http") ? item.link : undefined} {...(item.link.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            <Button size="sm" variant="outline" className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> Open original</Button>
          </a>
        )}
      </div>

      {showDraft && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <p className="text-xs font-semibold text-stone-500 mb-1.5">AI draft — review and edit before sending</p>
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} className="text-sm" />
          <Button size="sm" variant="outline" onClick={copyDraft} disabled={!draft} className="rounded-lg mt-2">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy reply
          </Button>
        </div>
      )}
    </div>
  );
}