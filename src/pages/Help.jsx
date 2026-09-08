import { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, LifeBuoy, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function Help() {
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef(null);

  useEffect(() => {
    base44.entities.HelpArticle.list("-created_date", 100).then(setArticles).catch(() => setArticles([]));
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => `${a.question || ""} ${a.answer || ""} ${a.category || ""}`.toLowerCase().includes(q));
  }, [articles, query]);

  const submit = async (event) => {
    event.preventDefault();
    if (!user || !form.message.trim() || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setStatus("Submitting…");
    try {
      const subject = form.subject.trim();
      const message = form.message.trim();
      // Keep the same intent key after a lost/failed response. An explicit edit
      // starts a new request; a double click cannot start a parallel submission.
      if (!attempt.current || attempt.current.subject !== subject || attempt.current.message !== message) {
        attempt.current = { request_id: crypto.randomUUID(), subject, message };
      }
      const { data } = await base44.functions.invoke("submitSupportTicket", attempt.current);
      if (data?.success !== true || !data.ticket_id) throw new Error("Submission not acknowledged");
      attempt.current = null;
      setForm({ subject: "", message: "" }); setShowForm(false); setStatus("Support request submitted.");
    } catch (error) {
      const code = error?.response?.status || error?.status;
      setStatus(code === 429 ? "Too many support requests. Please try again later." :
        code === 503 ? "Support submission is temporarily unavailable. Your message is still here; please retry shortly." :
          "Support request could not be confirmed. Your message is still here; retry without editing to check the same request.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <div className="text-center mb-8"><div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4"><LifeBuoy className="w-6 h-6 text-cyan-600" /></div><h1 className="font-display text-3xl text-stone-900">Help Center</h1><p className="text-stone-500 mt-2">Find answers about Interplanetary Fund.</p></div>
    <div className="relative mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help…" className="pl-9" /></div>
    <div className="space-y-2">{filtered.map((article) => <div key={article.id} className="bg-white rounded-xl border border-stone-200/70 overflow-hidden"><button type="button" onClick={() => setOpenId(openId === article.id ? null : article.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left"><span><span className="block text-[11px] uppercase tracking-wide text-primary mb-1">{article.category}</span><span className="font-medium text-stone-900">{article.question}</span></span><ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${openId === article.id ? "rotate-180" : ""}`} /></button>{openId === article.id && <p className="px-4 pb-4 text-sm text-stone-600 whitespace-pre-wrap">{article.answer}</p>}</div>)}</div>
    {!filtered.length && <p className="text-center py-10 text-stone-500">No matching help articles yet.</p>}
    {user && <div className="mt-8 text-center">
      <Button variant="outline" disabled={submitting} onClick={() => setShowForm((v) => !v)}>Contact support</Button>
      {showForm && <form onSubmit={submit} aria-busy={submitting} className="mt-4 text-left bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
        <label htmlFor="support-subject" className="block text-sm font-medium">Subject (optional)</label>
        <Input id="support-subject" maxLength={200} disabled={submitting} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <label htmlFor="support-message" className="block text-sm font-medium">How can we help?</label>
        <Textarea id="support-message" required maxLength={10000} disabled={submitting} rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <Button type="submit" disabled={submitting || !form.message.trim()}>{submitting ? "Submitting…" : "Submit request"}</Button>
      </form>}
      {status && <p className="text-sm text-stone-500 mt-3" role="status">{status}</p>}
    </div>}
  </div>;
}
