import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    base44.entities.HelpArticle.list("-created_date", 100).then(setArticles).catch(() => setArticles([]));
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => `${a.question || ""} ${a.answer || ""} ${a.category || ""}`.toLowerCase().includes(q));
  }, [articles, query]);

  const submit = async () => {
    if (!user || !form.message.trim()) return;
    setStatus("Submitting…");
    try {
      await base44.entities.SupportTicket.create({ user_id: user.id, name: user.full_name || user.username || "User", email: user.email || "", subject: form.subject.trim(), message: form.message.trim(), status: "open" });
      setForm({ subject: "", message: "" }); setShowForm(false); setStatus("Support request submitted.");
    } catch { setStatus("Support request could not be submitted. Please try again."); }
  };

  return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <div className="text-center mb-8"><div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4"><LifeBuoy className="w-6 h-6 text-cyan-600" /></div><h1 className="font-display text-3xl text-stone-900">Help Center</h1><p className="text-stone-500 mt-2">Find answers about Interplanetary Fund.</p></div>
    <div className="relative mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help…" className="pl-9" /></div>
    <div className="space-y-2">{filtered.map((article) => <div key={article.id} className="bg-white rounded-xl border border-stone-200/70 overflow-hidden"><button type="button" onClick={() => setOpenId(openId === article.id ? null : article.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left"><span><span className="block text-[11px] uppercase tracking-wide text-primary mb-1">{article.category}</span><span className="font-medium text-stone-900">{article.question}</span></span><ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${openId === article.id ? "rotate-180" : ""}`} /></button>{openId === article.id && <p className="px-4 pb-4 text-sm text-stone-600 whitespace-pre-wrap">{article.answer}</p>}</div>)}</div>
    {!filtered.length && <p className="text-center py-10 text-stone-500">No matching help articles yet.</p>}
    {user && <div className="mt-8 text-center"><Button variant="outline" onClick={() => setShowForm((v) => !v)}>Contact support</Button>{showForm && <div className="mt-4 text-left bg-white border border-stone-200 rounded-2xl p-5 space-y-3"><Input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /><Textarea placeholder="How can we help?" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /><Button onClick={submit} disabled={!form.message.trim()}>Submit request</Button></div>}{status && <p className="text-sm text-stone-500 mt-3" role="status">{status}</p>}</div>}
  </div>;
}
