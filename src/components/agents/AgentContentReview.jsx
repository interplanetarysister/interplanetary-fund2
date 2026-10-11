import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, ClipboardList, RefreshCcw } from "lucide-react";

const preview = (draft) => {
  const p = draft.payload || {};
  if (draft.kind === "campaign_changes" || draft.kind === "profile_update")
    return Object.entries(p).map(([key, value]) => key + ": " + (typeof value === "string" ? value : JSON.stringify(value))).join("\n");
  return [p.title, p.summary, p.content || p.body, p.bio].filter(Boolean).join("\n\n");
};
const titles = {
  social_post: "IFund social post",
  campaign_update: "Campaign update",
  campaign_changes: "Campaign changes",
  external_post: "Outside-platform draft",
  blog_entry: "Blog article draft",
  discussion_post: "Community discussion",
  discussion_reply: "Community reply",
  profile_update: "Profile changes",
};

export default function AgentContentReview() {
  const [drafts, setDrafts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [confirmed, setConfirmed] = useState({});
  const [error, setError] = useState("");

  const load = async () => {
    setBusy("load");setError("");
    try {
      const r=await base44.functions.invoke("manageAgentContentDraft", {mode:"list"});
      if(!r?.data?.ok)throw new Error("Drafts unavailable");
      setDrafts(r.data.drafts||[]);setLoaded(true);
    } catch { setError("Could not load AI content drafts. Try again."); }
    finally { setBusy(""); }
  };

  const act = async (draft, action) => {
    if(action==="apply"&&!confirmed[draft.id])return;
    setBusy(draft.id);setError("");
    try {
      const input=action==="apply"
        ? {draft_id:draft.id,confirm_owner_review:true}
        : {mode:"cancel",draft_id:draft.id};
      const fn=action==="apply"?"applyAgentContentDraft":"manageAgentContentDraft";
      const r=await base44.functions.invoke(fn,input);
      if(!r?.data?.ok)throw new Error("Could not complete the request");
      const next=action==="apply"
        ? {...draft,status:"applied",result_summary:r.data.result_summary||"Applied"}
        : {...draft,status:"cancelled"};
      setDrafts(items=>items.map(item=>item.id===draft.id?next:item));
      setConfirmed(current=>({...current,[draft.id]:false}));
    } catch {setError("This change was not confirmed. Review its status before trying again.");}
    finally{setBusy("");}
  };
  return <section aria-label="Review AI content drafts" className="space-y-3">
    <div className="flex flex-wrap gap-2 items-center justify-between">
      <div className="flex gap-2 items-center font-semibold text-foreground"><ClipboardList className="h-4 w-4"/>Review content your AI team prepared</div>
      <button type="button" onClick={load} disabled={!!busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground">
        <RefreshCcw className="h-4 w-4"/> {loaded?"Refresh":"Show drafts"}
      </button>
    </div>
    <p className="text-sm text-muted-foreground">Your AI team prepares drafts. Nothing here is posted or changed until you review and approve the specific draft below.</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {loaded && !drafts.length && <p className="text-sm text-muted-foreground">No AI drafts yet.</p>}
    {drafts.map(d=><article key={d.id} className="p-3 sm:p-4 rounded-xl border border-border bg-background space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <strong>{titles[d.kind]||d.kind}</strong>
        <span className="text-sm text-muted-foreground">{d.status}</span>
      </div>
      <p className="text-xs text-muted-foreground">Campaign: {d.campaign_id||"Not applicable"} · Destination: {d.connection_id||"IFund"} · Drafted by {d.source_agent||"AI team"}</p>
      <pre className="max-h-56 overflow-auto rounded-lg border border-border p-3 text-sm text-foreground font-sans whitespace-pre-wrap break-words">{preview(d)||JSON.stringify(d.payload,null,2)}</pre>
      {d.status==="draft"&&<>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-1" checked={!!confirmed[d.id]} onChange={e=>setConfirmed(c=>({...c,[d.id]:e.target.checked}))}/>
          <span>I reviewed this exact content and destination and approve the resulting IFund action.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy||!confirmed[d.id]} onClick={()=>act(d,"apply")}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50"><Check className="h-4 w-4"/>Apply approved content</button>
          <button type="button" disabled={!!busy} onClick={()=>act(d,"cancel")}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-foreground">Discard</button>
        </div>
      </>}
      {d.result_summary&&<p className="text-sm text-muted-foreground">{d.result_summary}</p>}
      {d.status==="failed"&&<p className="text-sm text-destructive">The last attempt was not confirmed. Check for a partial result before preparing another draft.</p>}
    </article>)}
  </section>;
}
