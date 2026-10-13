import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, ChevronUp, Loader2, Mail } from "lucide-react";

// Company emails live in the existing universal inbox, not a second mailbox page.
// The API sends plain text only; external email HTML is never executed in IFund.
export default function CompanyMailCard({ item, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");
  const open = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (message) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("ifundDomainMail", {
        action: "get", id: item.mail_id,
      });
      if (!data?.ok || !data.message) throw new Error("message unavailable");
      setMessage(data.message);
    } catch {
      setError("This message couldn't be opened. Try again.");
    } finally {
      setLoading(false);
    }
  };
  const markRead = async () => {
    setMarking(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("ifundDomainMail", {
        action: "read", id: item.mail_id,
      });
      if (data?.ok !== true) throw new Error("update unavailable");
      onChanged({ ...item, status: "done" });
    } catch {
      setError("Couldn't mark this email as read.");
    } finally {
      setMarking(false);
    }
  };
  return (
    <article className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Company email</Badge>
        {item.status === "open" && <Badge className="bg-violet-100 text-violet-800 border-0">Unread</Badge>}
        <span className="text-xs text-stone-500 break-all">To: {item.mail_recipient}</span>
      </div>
      <h3 className="text-sm font-semibold text-stone-900 mt-2 break-words">{item.mail_subject || "(No subject)"}</h3>
      <p className="text-xs text-stone-600 mt-1 break-all">From: {item.author || "Unknown sender"}</p>
      <p className="text-sm text-stone-700 mt-2 break-words">{item.content?.split(" — ").slice(1).join(" — ") || ""}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={open} disabled={loading}
          aria-expanded={expanded} className="rounded-lg">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : expanded
            ? <ChevronUp className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
          {expanded ? "Close message" : "Read message"}
        </Button>
        {item.status !== "done" &&
          <Button size="sm" variant="outline" onClick={markRead} disabled={marking}
            className="rounded-lg">
            {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Mark read
          </Button>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {expanded && message && (
        <section aria-label="Email message" className="mt-3 pt-3 border-t border-stone-200">
          <p className="text-xs text-stone-600 mb-2 break-all">To: {message.recipient}</p>
          <div className="text-sm leading-relaxed text-stone-900 whitespace-pre-wrap break-words max-h-[70vh] overflow-y-auto">
            {message.body_text || "(No plain-text message content)"}
          </div>
          <p className="text-xs text-stone-500 mt-3">
            Attachments are held securely but are not available for download in this initial version.
          </p>
        </section>
      )}
    </article>
  );
}
