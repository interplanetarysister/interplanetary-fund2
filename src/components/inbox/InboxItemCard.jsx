import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateInboxState } from "@/lib/inboxState";
import { draftInboxReply } from "@/lib/creditFreeGenerators";
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
  const navigate = useNavigate();
  const [draft, setDraft] = useState(item.ai_draft || "");
  const [drafting, setDrafting] = useState(false);
  const [showDraft, setShowDraft] = useState(!!item.ai_draft);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const generateDraft = async () => {
    setDrafting(true);
    setError("");
    setShowDraft(true);
    try {
      const text = draftInboxReply(item, platformName(item.platform)).slice(0, 5000);
      setDraft(text);
      if (item.record_id) {
        const result = await updateInboxState({ action: "save_draft", id: item.record_id, draft: text });
        setDraft(result.draft);
      }
    } catch { setError("Your draft could not be saved. Please try again."); }
    finally { setDrafting(false); }
  };

  const saveDraft = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await updateInboxState({ action: "save_draft", id: item.record_id, draft });
      setDraft(result.draft);
      onChanged({ ...item, ai_draft: result.draft });
    } catch { setError("Your draft could not be saved. Please try again."); }
    finally { setSaving(false); }
  };

  const markDone = async () => {
    setSaving(true);
    setError("");
    try {
      if (item.record_id) await updateInboxState({ action: "complete", id: item.record_id });
      else if (item.notification_id) await updateInboxState({ action: "read_notification", id: item.notification_id });
      else return;
      onChanged({ ...item, status: "done" });
    } catch { setError("This item could not be marked done. Please try again."); }
    finally { setSaving(false); }
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setError("Copy failed. Select and copy the draft text instead."); }
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
          <Button size="sm" variant="outline" onClick={markDone} disabled={saving || drafting} className="rounded-lg"><Check className="w-3.5 h-3.5" /> Done</Button>
        )}
        <Button size="sm" variant="outline" onClick={generateDraft} disabled={drafting || saving} className="rounded-lg text-primary">
          {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Draft reply
        </Button>
        {item.link && (
          item.link.startsWith("http") ? (
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> Open original</Button>
            </a>
          ) : (
            <Button size="sm" variant="outline" onClick={() => navigate(item.link)} className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> Open</Button>
          )
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      {showDraft && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <p className="text-xs font-semibold text-stone-500 mb-1.5">Credit-free draft — review and edit before sending</p>
          <Textarea aria-label="Reply draft" maxLength={5000} rows={3} value={draft} onChange={(e) => { setDraft(e.target.value); setCopied(false); }} className="text-sm" />
          {item.record_id && <Button size="sm" variant="outline" onClick={saveDraft} disabled={saving || drafting} className="rounded-lg mt-2">Save draft</Button>}
          <Button size="sm" variant="outline" onClick={copyDraft} disabled={!draft} className="rounded-lg mt-2">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy reply
          </Button>
        </div>
      )}
    </div>
  );
}
