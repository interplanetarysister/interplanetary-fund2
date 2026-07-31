import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logPlatformEvent } from "./logPlatformEvent";
import { Loader2, Plus, Search, Sparkles } from "lucide-react";
import { format } from "date-fns";

const categories = {
  architecture_decision: "Architecture Decision",
  runbook: "Runbook",
  playbook: "Playbook",
  standard: "Standard",
  data_model: "Data Model",
  release_notes: "Release Notes",
  troubleshooting: "Troubleshooting",
  other: "Other",
};

export default function KnowledgePanel() {
  const [articles, setArticles] = useState(null);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "runbook", content: "" });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    base44.entities.KnowledgeArticle.list("-created_date", 100).then(setArticles);
  }, []);

  if (!articles) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-orange-600" /></div>;
  }

  const publish = async () => {
    setSaving(true);
    const me = await base44.auth.me();
    const summary = await base44.integrations.Core.InvokeLLM({
      prompt: `Summarize this engineering document in 2 plain-language sentences for a non-technical reader.\n\nTitle: ${form.title}\n\n${form.content}`,
    });
    const article = await base44.entities.KnowledgeArticle.create({
      ...form,
      summary,
      version: 1,
      author_name: me.full_name || me.email,
    });
    await logPlatformEvent({
      action: "Knowledge asset published",
      category: "knowledge",
      affected_resource: article.title,
      details: categories[article.category],
    });
    setArticles((prev) => [article, ...prev]);
    setForm({ title: "", category: "runbook", content: "" });
    setShowForm(false);
    setSaving(false);
  };

  const q = query.toLowerCase();
  const filtered = articles.filter((a) => !q || a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the knowledge repository…" className="pl-9" />
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
            <Plus className="w-4 h-4" /> New document
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Document title" />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(categories).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Document content…" />
          <p className="text-xs text-stone-400 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> A plain-language AI summary is generated on publish.</p>
          <div className="flex gap-2">
            <Button onClick={publish} disabled={saving || !form.title || !form.content} className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">No documents yet — publish your first runbook or architecture decision.</p>
      ) : (
        filtered.map((a) => (
          <div key={a.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{a.title}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  v{a.version} · {a.author_name} · {format(new Date(a.created_date), "MMM d, yyyy")}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">{categories[a.category] || a.category}</Badge>
            </div>
            {a.summary && <p className="text-sm text-stone-600 mt-2">{a.summary}</p>}
            <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="text-xs font-medium text-orange-600 hover:text-orange-500 mt-3">
              {expanded === a.id ? "Hide full document" : "Read full document"}
            </button>
            {expanded === a.id && (
              <div className="mt-3 rounded-xl bg-stone-50 p-4">
                <p className="text-sm text-stone-700 whitespace-pre-line">{a.content}</p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}