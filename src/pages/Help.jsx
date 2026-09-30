import { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, LifeBuoy, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SAFE_HELP_ERROR = "Help content is temporarily unavailable. Please try again.";
const MAX_ARTICLES = 100;
const MAX_TEXT = 4000;

function isSafeArticle(row) {
  return Boolean(
    row && typeof row === "object" &&
    typeof row.id === "string" && row.id.length > 0 && row.id.length <= 160 &&
    typeof row.question === "string" && row.question.length <= MAX_TEXT &&
    typeof row.answer === "string" && row.answer.length <= MAX_TEXT &&
    (row.category == null || (typeof row.category === "string" && row.category.length <= 120))
  );
}

function parseArticles(value) {
  if (!Array.isArray(value) || value.length > MAX_ARTICLES) throw new Error("invalid_help_articles");
  const seen = new Set();
  const rows = value.map((row) => {
    if (!isSafeArticle(row) || seen.has(row.id)) throw new Error("invalid_help_article_row");
    seen.add(row.id);
    return row;
  });
  return rows;
}

export default function Help() {
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const requestGeneration = useRef(0);

  useEffect(() => {
    let mounted = true;
    const generation = ++requestGeneration.current;
    setLoadError("");

    Promise.all([
      base44.entities.HelpArticle.list("-created_date", MAX_ARTICLES),
      base44.auth.me(),
    ]).then(([articleRows, currentUser]) => {
      if (!mounted || generation !== requestGeneration.current) return;
      setArticles(parseArticles(articleRows));
      setUser(currentUser || null);
    }).catch(() => {
      if (!mounted || generation !== requestGeneration.current) return;
      setArticles([]);
      setUser(null);
      setLoadError(SAFE_HELP_ERROR);
    });

    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => `${a.question} ${a.answer} ${a.category || ""}`.toLowerCase().includes(q));
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
    {loadError && <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>}
    <div className="relative mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help…" className="pl-9" /></div>
    <div className="space-y-2">{filtered.map((article) => <div key={article.id} className="bg-white rounded-xl border border-stone-200/70 overflow-hidden"><button type="button" onClick={() => setOpenId(openId === article.id ? null : article.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left"><span><span className="block text-[11px] uppercase tracking-wide text-primary mb-1">{article.category}</span><span className="font-medium text-stone-900">{article.question}</span></span><ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${openId === article.id ? "rotate-180" : ""}`} /></button>{openId === article.id && <p className="px-4 pb-4 text-sm text-stone-600 whitespace-pre-wrap">{article.answer}</p>}</div>)}</div>
    {!loadError && !filtered.length && <p className="text-center py-10 text-stone-500">No matching help articles yet.</p>}
    {user && <div className="mt-8 text-center"><Button variant="outline" onClick={() => setShowForm((v) => !v)}>Contact support</Button>{showForm && <div className="mt-4 text-left bg-white border border-stone-200 rounded-2xl p-5 space-y-3"><Input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /><Textarea placeholder="How can we help?" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /><Button onClick={submit} disabled={!form.message.trim()}>Submit request</Button></div>}{status && <p className="text-sm text-stone-500 mt-3" role="status">{status}</p>}</div>}
  </div>;
}
