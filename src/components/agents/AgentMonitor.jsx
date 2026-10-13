import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import AgentChat from "@/components/agents/AgentChat";
import AgentContentReview from "@/components/agents/AgentContentReview";
import AdminDevelopmentChat from "@/components/agents/AdminDevelopmentChat";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ArrowRight, Bell, CheckCircle2, Clock3, MessageCircle, RefreshCw } from "lucide-react";

// Status comes from owner-scoped server records. Roster membership is never
// evidence that an agent is executing work for a member.
const EXECUTING = new Set(["responding", "in_progress"]);
const REQUIRES_USER = new Set(["waiting_user", "needs_review"]);
const FINISHED = new Set(["responded", "completed", "tool_failed", "failed", "delivery_unconfirmed"]);
const AGE_LIMIT_MS = 10 * 60 * 1000;

const timestamp = (entry) => {
  const t = Date.parse(entry?.updated_at || entry?.created_at || entry?.created_date || "");
  return Number.isFinite(t) ? t : 0;
};
const compact = (str, n = 105) => String(str || "").replace(/\s+/g, " ").trim().slice(0, n);
const readKey = (userId, agentName) => "ifund:agent-monitor:seen:" + userId + ":" + agentName;

function readSeen(userId, names) {
  const next = {};
  for (const name of names) {
    try { next[name] = Number(window.localStorage.getItem(readKey(userId, name))) || 0; }
    catch { next[name] = 0; }
  }
  return next;
}

function AgentPlanet({ kind }) {
  const halo = kind === "working" ? "ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,.8)] animate-pulse" :
    kind === "new" ? "ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,.8)]" :
    "grayscale opacity-65 ring-1 ring-slate-300";
  const label = kind === "working" ? "Working now" : kind === "new" ? "New activity" : kind === "unknown" ? "Status unavailable" : "No new activity";
  return <span className={"inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full " + halo}
    title={label} aria-label={label}>
    <img src="/interplanetary-planet.svg" alt="" aria-hidden="true" className="h-9 w-9 object-cover" />
  </span>;
}

function classify(agent, work, drafts, suggestions, seenAt, statusLoaded) {
  if (!statusLoaded) return { kind: "unknown", text: "Status unavailable", detail: "Try refreshing the monitor.", count: 0 };
  const items = work.filter((item) => item.agent === agent.name);
  const newest = [...items].sort((a, b) => timestamp(b) - timestamp(a))[0];
  const executing = items.find((item) => EXECUTING.has(item.status) &&
    timestamp(item) > Date.now() - AGE_LIMIT_MS);
  const toReview = drafts.filter((draft) => draft.status === "draft" && draft.source_agent === agent.name);
  // AgentActivity has no source-agent field: show these as team updates under
  // Chief of Staff, never falsely credit a particular specialist.
  const teamSuggestions = agent.name === "chief_of_staff" ?
    suggestions.filter((item) => item.status === "pending") : [];
  const freshSuggestions = [...toReview, ...teamSuggestions].filter((item) => timestamp(item) > seenAt);
  const newWork = items.filter((item) => FINISHED.has(item.status) && timestamp(item) > seenAt);
  const needsHelp = items.some((item) => REQUIRES_USER.has(item.status));
  if (executing) {
    return { kind: "working", text: "Working now",
      detail: compact(executing.objective || "Handling your request"), count: freshSuggestions.length + newWork.length };
  }
  if (freshSuggestions.length || newWork.length) {
    return { kind: "new", text: "New update",
      detail: freshSuggestions.length ? "New suggestion or prepared content to review" :
        compact(newWork[0]?.result_summary || newWork[0]?.objective || "Agent response available"),
      count: freshSuggestions.length + newWork.length };
  }
  if (needsHelp || toReview.length || teamSuggestions.length) {
    return { kind: "new", text: "Needs your review",
      detail: toReview.length || teamSuggestions.length ? "Prepared content or suggestions await review" :
        "An agent needs your input to continue",
      count: toReview.length + teamSuggestions.length };
  }
  if (newest?.status === "waiting_external") return { kind: "idle", text: "Waiting for provider",
    detail: compact(newest.objective || "External service response pending"), count: 0 };
  if (newest?.status === "requested" || newest?.status === "assigned") {
    return { kind: "idle", text: "Queued", detail: compact(newest.objective || "Request recorded"), count: 0 };
  }
  if (newest?.status === "responding" || newest?.status === "in_progress") {
    return { kind: "idle", text: "Update overdue", detail: "Previous work status has not been refreshed recently.", count: 0 };
  }
  return { kind: "idle", text: "Available", detail: "Select to chat or assign a request.", count: 0 };
}

export default function AgentMonitor({ user, agents, canUseAdminTools }) {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [chatMode, setChatMode] = useState("chat");
  const [work, setWork] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [seen, setSeen] = useState(() => readSeen(user.id, agents.map((agent) => agent.name)));
  const [loading, setLoading] = useState(true);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      base44.functions.invoke("manageAgentWork", { mode: "list", view: "all" }),
      base44.functions.invoke("trackAgentConversation", { mode: "list" }),
      base44.functions.invoke("manageAgentContentDraft", { mode: "list" }),
      base44.entities.AgentActivity.filter({ owner_user_id: user.id }, "-created_date", 50),
    ]);
    const data = results.map((result) => result.status === "fulfilled" ? result.value?.data : null);
    const tasks = Array.isArray(data[0]?.work) && data[0]?.ok ? data[0].work : null;
    const chats = Array.isArray(data[1]?.runs) && data[1]?.ok ? data[1].runs : null;
    const prepared = Array.isArray(data[2]?.drafts) && data[2]?.ok ? data[2].drafts : null;
    const suggestionsResult = results[3].status === "fulfilled" && Array.isArray(results[3].value)
      ? results[3].value : null;
    // Refresh actual specialist handoff results. A record marked "assigned"
    // is not completion; only a resolved specialist response can advance it.
    let checkedTasks = tasks;
    if (tasks !== null) {
      const active = tasks.filter((task) => task.status === "in_progress" &&
        task.agent !== "managed_connection_agent").slice(0, 8);
      if (active.length) {
        const checks = await Promise.allSettled(active.map((task) =>
          base44.functions.invoke("routeAgentTask", { mode: "status", delegation_id: task.id })));
        const updates = new Map(checks.flatMap((result) => {
          const handoff = result.status === "fulfilled" ? result.value?.data?.handoff : null;
          return handoff?.id ? [[handoff.id, handoff]] : [];
        }));
        checkedTasks = tasks.map((task) => {
          const updated = updates.get(task.id);
          return updated ? { ...task, status: updated.status, agent: updated.destination_agent,
            result_summary: updated.result_summary, updated_at: updated.updated_at } : task;
        });
      }
    }
    if (checkedTasks !== null) setWork(checkedTasks);
    if (chats !== null) setWork((current) => {
      // Keep fresh delegated tasks if their independent request succeeded.
      const source = checkedTasks !== null ? checkedTasks : current.filter((item) => item.kind !== "chat");
      return [...source, ...chats];
    });
    if (prepared !== null) setDrafts(prepared);
    if (suggestionsResult !== null) setSuggestions(suggestionsResult);
    const recordsAvailable = tasks !== null || chats !== null;
    const success = recordsAvailable || prepared !== null || suggestionsResult !== null;
    setStatusLoaded((current) => current || recordsAvailable);
    setError(recordsAvailable ? "" : success ? "Live work status could not be checked; review items may still appear." : "Activity could not be checked. Existing statuses may be out of date.");
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    let live = true;
    const update = () => { if (live && document.visibilityState !== "hidden") void refresh(); };
    update();
    const interval = window.setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => { live = false; window.clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);

  const states = useMemo(() => agents.map((agent) => ({
    agent, signal: classify(agent, work, drafts, suggestions, seen[agent.name] || 0, statusLoaded),
  })), [agents, work, drafts, suggestions, seen, statusLoaded]);

  const openAgent = (agent) => {
    const now = Date.now();
    try { window.localStorage.setItem(readKey(user.id, agent.name), String(now)); }
    catch { /* A private browser may not persist read indicators. */ }
    setSeen((current) => ({ ...current, [agent.name]: now }));
    setChatMode("chat");
    setSelected(agent);
    setOpen(true);
  };

  const selectedAgent = selected && agents.find((agent) => agent.name === selected.name);
  const activeCount = states.filter((row) => row.signal.kind === "working").length;
  const attentionCount = states.filter((row) => row.signal.kind === "new").length;

  return <div className="mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Your AI team</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">See which agents are helping, find new updates, or tap an agent to talk about your campaigns.</p>
      </div>
      <button type="button" onClick={refresh} disabled={loading}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted">
        <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
        Refresh
      </button>
    </div>
    <div className="mb-5 flex flex-wrap gap-3 text-xs text-muted-foreground" aria-live="polite">
      <span className="inline-flex items-center gap-2"><AgentPlanet kind="working" /> {activeCount} working</span>
      <span className="inline-flex items-center gap-2"><AgentPlanet kind="new" /> {attentionCount} with updates</span>
      <span className="inline-flex items-center gap-2"><AgentPlanet kind="idle" /> Available to chat</span>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
    {loading && !statusLoaded && <p role="status" className="mb-3 text-sm text-muted-foreground">Checking your agents' activity…</p>}
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)]">
      <section aria-label="Monitored agents" className="space-y-2">
        {states.map(({ agent, signal }) => {
          const Icon = agent.icon;
          return <button type="button" key={agent.name} onClick={() => openAgent(agent)}
            className={"group flex w-full min-w-0 items-center gap-3 rounded-2xl border bg-card px-3 py-3 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-4 " +
              (signal.kind === "working" ? "border-cyan-400" : signal.kind === "new" ? "border-amber-400" : "border-border")}
            aria-label={"Talk to " + agent.label + ", " + signal.text}>
            <AgentPlanet kind={signal.kind} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-bold text-foreground sm:text-base">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{agent.label}</span>
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{signal.detail}</span>
            </span>
            <span className="flex max-w-[5.5rem] shrink-0 flex-col items-end gap-1">
              <span className={"text-right text-[11px] font-semibold " +
                (signal.kind === "working" ? "text-cyan-700 dark:text-cyan-300" :
                  signal.kind === "new" ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
                {signal.text}
              </span>
              {signal.count > 0 && <span className="text-[11px] text-muted-foreground">{signal.count} new</span>}
              <MessageCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </span>
          </button>;
        })}
      </section>
      <aside className="min-w-0 self-start space-y-4">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><Bell className="h-5 w-5 text-primary" /> Activity at a glance</h2>
          <p className="mt-2 text-sm text-muted-foreground">A glowing planet means an agent has recently confirmed work or something needs your attention. A quiet planet means no confirmed new work.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted p-3"><p className="text-xl font-bold text-foreground">{activeCount}</p><p className="text-xs text-muted-foreground">Working</p></div>
            <div className="rounded-xl bg-muted p-3"><p className="text-xl font-bold text-foreground">{attentionCount}</p><p className="text-xs text-muted-foreground">Updates to check</p></div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-4 w-4" /> Status refreshes while this page is open.
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><CheckCircle2 className="h-5 w-5 text-primary" /> You stay in control</h2>
          <p className="mt-2 text-sm text-muted-foreground">Select an agent to give instructions or review its work. Opening a chat does not authorize spending, publishing, or changing your connected accounts.</p>
          <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary">Choose an agent <ArrowRight className="h-4 w-4" /></div>
        </section>
      </aside>
    </div>

    <Sheet open={open} onOpenChange={(next) => { setOpen(next); if (!next) void refresh(); }}>
      <SheetContent side="right" className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom))] pt-16 sm:w-[min(100vw,42rem)] sm:max-w-2xl">
        {selectedAgent && <>
          <SheetHeader className="shrink-0 text-left">
            <SheetTitle className="flex items-center gap-3 text-lg"><AgentPlanet kind={states.find((s) => s.agent.name === selectedAgent.name)?.signal.kind || "idle"} />{selectedAgent.label}</SheetTitle>
            <SheetDescription>Ask about your campaigns, account, or the work you want this agent to do.</SheetDescription>
          </SheetHeader>
          {canUseAdminTools && selectedAgent.name === "chief_of_staff" && <div role="group" aria-label="Admin chat access" className="mt-2 flex shrink-0 gap-2">
            <button type="button" aria-pressed={chatMode === "chat"} onClick={() => setChatMode("chat")} className={"min-h-11 rounded-lg border px-3 text-sm font-semibold " + (chatMode === "chat" ? "bg-primary text-primary-foreground" : "bg-card text-foreground")}>Chat</button>
            <button type="button" aria-pressed={chatMode === "admin"} onClick={() => setChatMode("admin")} className={"min-h-11 rounded-lg border px-3 text-sm font-semibold " + (chatMode === "admin" ? "bg-primary text-primary-foreground" : "bg-card text-foreground")}>Admin tools</button>
          </div>}
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card p-3">
            {canUseAdminTools && selectedAgent.name === "chief_of_staff" && chatMode === "admin"
              ? <div className="min-h-0 flex-1 overflow-y-auto"><AdminDevelopmentChat user={user} /></div>
              : <AgentChat key={selectedAgent.name} agentName={selectedAgent.name} agentLabel={selectedAgent.label} greeting={selectedAgent.greeting} overlayMode />}
          </div>
          <details className="mt-3 shrink-0 rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Review suggestions and prepared content</summary>
            <div className="max-h-[35dvh] overflow-y-auto pt-3"><AgentContentReview /></div>
          </details>
        </>}
      </SheetContent>
    </Sheet>
  </div>;
}
