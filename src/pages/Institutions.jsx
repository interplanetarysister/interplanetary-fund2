import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import InstitutionCard from "@/components/institutions/InstitutionCard";
import CreateInstitutionDialog from "@/components/institutions/CreateInstitutionDialog";
import MyApplications from "@/components/institutions/MyApplications";
import { Search, Loader2 } from "lucide-react";
import { institutionTypes } from "@/components/institutions/institutionTypes";
import PageError from "@/components/PageError";

const programFilters = [
  { value: "all", label: "All" },
  { value: "offers_grants", label: "Grants" },
  { value: "offers_matching_gifts", label: "Matching Gifts" },
  { value: "offers_volunteer_program", label: "Volunteer Programs" },
];

export default function Institutions() {
  const [institutions, setInstitutions] = useState(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [researchSources, setResearchSources] = useState([]);
  const [researchState, setResearchState] = useState("loading");
  const [researchType, setResearchType] = useState("all");
  useEffect(() => {
    let active = true;
    setResearchState("loading");
    fetch("https://interplanetaryfund.com/api/public/opportunity-sources", { cache:"no-store", signal:AbortSignal.timeout(10000) })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(result.sources) || result.source !== "canonical_supabase_rls") throw Error("Canonical opportunity source unavailable");
        if (active) { setResearchSources(result.sources); setResearchState("ready"); }
      })
      .catch(() => { if (active) setResearchState("error"); });
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    base44.entities.Institution.list("-created_date", 100)
      .then(setInstitutions)
      .catch((e) => { console.error("Institutions load failed:", e?.name || "UnknownError"); setError("We couldn't load institutions. Please try again."); });
  }, [reloadKey]);

  if (error) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setInstitutions(null); setReloadKey((key) => key + 1); }} /></div>;
  }
  if (!institutions) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const q = query.toLowerCase();
  const filtered = institutions.filter(
    (i) =>
      (typeFilter === "all" || i.type === typeFilter) &&
      (programFilter === "all" || i[programFilter]) &&
      (!q ||
        i.name?.toLowerCase().includes(q) ||
        i.mission?.toLowerCase().includes(q) ||
        i.industry?.toLowerCase().includes(q) ||
        i.causes_supported?.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q))
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Institutions</h1>
          <p className="text-stone-500 mt-1">Businesses, foundations, and organizations partnering with campaigns.</p>
        </div>
        <CreateInstitutionDialog />
      </div>


      <section className="my-6 space-y-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/5 p-4 sm:p-6" aria-label="AI opportunity research sources">
        <div>
          <h2 className="text-xl font-bold">Worldwide grant, business & volunteer research</h2>
          <p className="mt-2 text-sm text-muted-foreground">This source directory is shared live with interplanetaryfund.com from canonical Supabase. The AI research agent is evaluating campaign relevance and will add independently verified opportunities. These are external research portals, not IFund partners or guaranteed awards.</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter research source">
          {[["all","All sources"],["grants","Grants"],["business","Business"],["volunteer","Volunteer"]].map(([key,label])=>
            <button key={key} type="button" aria-pressed={researchType===key} onClick={()=>setResearchType(key)}
              className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold ${researchType===key?"border-cyan-500 bg-cyan-600 text-white":"border-border bg-background"}`}>{label}</button>
          )}
        </div>
        {researchState==="loading" && <p role="status" className="text-sm">Loading verified source directory…</p>}
        {researchState==="error" && <div role="alert" className="rounded-xl border border-amber-500/40 p-3 text-sm">Live source verification is temporarily unavailable. No unverified listings were substituted.
          <a href="https://interplanetaryfund.com/institutions" target="_blank" rel="noopener noreferrer" className="ml-2 font-bold underline">Browse live directory</a>
        </div>}
        {researchState==="ready" && <div className="grid gap-3 sm:grid-cols-2">
          {researchSources.filter(s=>researchType==="all" || s.industry===researchType).map(s=>
            <article key={s.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">{s.industry} · {s.location}</p>
              <h3 className="mt-2 text-lg font-bold">{s.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
              <a href={s.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">Browse current provider listings</a>
            </article>
          )}
        </div>}
        <p className="text-xs text-muted-foreground">The research source's current listings, dates, and eligibility must be reviewed before contacting or applying. Your campaign is not automatically eligible; no applications are sent.</p>
      </section>

      <MyApplications />

      <div className="relative mt-8 mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, mission, industry, cause, or location…" className="pl-9" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {programFilters.map((f) => (
          <button key={f.value} onClick={() => setProgramFilter(f.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              programFilter === f.value ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {[["all", "All types"], ...Object.entries(institutionTypes)].map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === v ? "bg-primary text-primary-foreground" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-16">
          {institutions.length === 0 ? "No institutions yet — register the first one." : "No institutions match your filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((i) => <InstitutionCard key={i.id} institution={i} />)}
        </div>
      )}
    </div>
  );
}