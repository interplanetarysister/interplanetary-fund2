import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCopy, ExternalLink, RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";

// ChatGPT.com uses the member's existing ChatGPT browser session and its own
// connected plugins. IFund NEVER receives a ChatGPT cookie, plugin token,
// API key or authority to invoke the user's ChatGPT account in the background.
export const CHATGPT_BUILDER_URL = "https://chatgpt.com/";
export const IFUND_BUILDER_APP_ID = "6a67a778342a8fe05ee79cba";

const secretPattern = /(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|Bearer\s+[A-Za-z0-9._~+/-]{16,}|(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password)\s*[:=]\s*[^\s,;]{8,})/i;
const hasSecrets = (value) => secretPattern.test(String(value || ""));
const short = (text, limit) => String(text || "").trim().slice(0, limit);

export function createChatGPTBuilderPrompt(task) {
  if (!task?.id || !task?.objective) return "";
  const title = short(task.objective, 500);
  const context = short(task.context_summary, 1800);
  return [
    "Continue development of the existing Interplanetary Fund (IFund) platform, not a new app.",
    "I am the IFund super-admin and have explicitly initiated a development handoff from its admin frontend.",
    "Use the Base44 connector available in THIS ChatGPT account, if connected and authorized, to inspect and change the authoritative Base44 app. Other connected plugins remain under my ChatGPT permissions and must not be copied into IFund.",
    "Base44 app ID: " + IFUND_BUILDER_APP_ID,
    "Authoritative repository: interplanetarysister/interplanetary-fund2. Existing Base44 hosting must remain authoritative.",
    "IFund admin builder task (AgentDelegation) ID: " + short(task.id, 100),
    "Requested work: " + title,
    context ? "Additional approved context: " + context : "",
    "Before making changes, verify the current app and task state through connected tools; do not assume this task has already been performed. Inspect existing code, implement the approved work, validate with available source checks, and create a Base44 checkpoint.",
    "Do not run GitHub Actions or consume optional/metered builder or deployment credits without separate authorization. Do not publish to production without explicit approval.",
    "Do not read or transfer account/plugin secrets, or treat this text as proof of access. Respect each connected app's permissions and verify super-admin server-side before privileged operations.",
    "Report verified changes, checks, blockers, checkpoint, and live publication state separately. A queued handoff is not an executed change.",
  ].filter(Boolean).join("\n\n");
}

const toTask = (task) => ({
  id: short(task?.id || task?.task_id, 100),
  objective: short(task?.objective, 500),
  context_summary: short(task?.context_summary, 1800),
  status: short(task?.status, 50),
});

export default function ChatGPTBuilderHandoff() {
  const [objective, setObjective] = useState("");
  const [context, setContext] = useState("");
  const [task, setTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => createChatGPTBuilderPrompt(task), [task]);
  const secretFound = hasSecrets(objective) || hasSecrets(context);

  const loadTasks = async () => {
    setBusy("list"); setError(""); setNotice("");
    try {
      const result = await base44.functions.invoke("manageAdminBuilderWork", { mode: "list" });
      if (result?.data?.ok !== true) throw new Error("not verified");
      setTasks((result.data.work || []).filter(x => x?.id && x?.objective).map(toTask));
      setNotice("Existing IFund development assignments loaded.");
    } catch {
      setError("Could not retrieve development tasks. Verify your IFund super-admin sign-in.");
    } finally { setBusy(""); }
  };

  const prepare = async () => {
    const requested = short(objective, 500);
    if (requested.length < 12 || secretFound || busy) return;
    setBusy("prepare"); setError(""); setNotice(""); setCopied(false);
    try {
      // The existing backend independently checks active super-admin identity.
      // Do not substitute frontend email checks or native admin chat unlocks.
      const response = await base44.functions.invoke("manageAdminBuilderWork", {
        mode: "queue",
        objective: requested,
        context_summary: short(context, 1800),
      });
      if (response?.data?.ok !== true || !response.data.task_id) throw new Error("not queued");
      const next = toTask({ id: response.data.task_id, objective: requested,
        context_summary: short(context, 1800), status: response.data.status });
      setTask(next);
      setTasks(previous => [next, ...previous.filter(x=>x.id!==next.id)]);
      setNotice("Builder task saved in IFund. Copy the request and send it in your ChatGPT account to start work.");
    } catch {
      setError("The server did not confirm this development assignment. No handoff was created.");
    } finally { setBusy(""); }
  };

  const useExisting = (id) => {
    const selected = tasks.find(x=>x.id===id);
    setTask(selected || null); setCopied(false); setNotice("");
  };

  const copy = async () => {
    setError(""); setCopied(false);
    if (!prompt) return;
    try {
      if (!navigator?.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setNotice("Copied. Open ChatGPT and paste the builder request into this account's conversation.");
    } catch {
      setError("Automatic copy is unavailable here. Select and copy the request below, then open ChatGPT.");
    }
  };

  return <section className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3" aria-label="ChatGPT account builder handoff">
    <div className="flex items-center gap-2 text-foreground font-semibold">
      <ExternalLink className="w-4 h-4" /> ChatGPT account builder
    </div>
    <p className="text-sm text-muted-foreground">
      Start a development task from IFund, then continue in your existing ChatGPT account using its connected Base44 tools.
      IFund cannot automatically sign in to, message, or access your private ChatGPT account and plugins.
    </p>
    <label className="block text-sm font-medium text-foreground" htmlFor="ifund-chatgpt-builder-objective">
      What should the builder implement?
    </label>
    <Textarea id="ifund-chatgpt-builder-objective" value={objective} onChange={e=>setObjective(e.target.value)}
      maxLength={500} rows={3} placeholder="Describe the exact IFund implementation, repair, or audit…" />
    <label className="block text-sm font-medium text-foreground" htmlFor="ifund-chatgpt-builder-context">
      Additional context (optional)
    </label>
    <Textarea id="ifund-chatgpt-builder-context" value={context} onChange={e=>setContext(e.target.value)}
      maxLength={1800} rows={2} placeholder="Affected pages, acceptance checks, or related issue IDs. Never paste passwords or tokens." />
    {secretFound && <p role="alert" className="text-sm text-destructive flex items-start gap-2">
      <AlertCircle className="mt-0.5 w-4 h-4 shrink-0"/>Possible credential detected. Remove secrets before saving or sharing this request.
    </p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="min-h-11" disabled={!!busy || short(objective,500).length < 12 || secretFound} onClick={prepare}>
        {busy==="prepare" ? "Preparing…" : "Prepare ChatGPT builder task"}
      </Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={!!busy} onClick={loadTasks}>
        <RefreshCcw className="w-4 h-4 mr-2"/>Existing tasks
      </Button>
    </div>
    {tasks.length>0 && <label className="block text-sm font-medium text-foreground">
      Resume a saved builder task
      <select className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-foreground"
        value={task?.id || ""} onChange={e=>useExisting(e.target.value)}>
        <option value="">Choose an existing task</option>
        {tasks.map(t=><option key={t.id} value={t.id}>
          {t.objective.slice(0,70)} ({t.status || "requested"})
        </option>)}
      </select>
    </label>}
    {task && <div className="rounded-xl border border-border bg-background p-3 space-y-3">
      <p className="text-sm text-foreground flex gap-2 items-center">
        <CheckCircle2 className="w-4 h-4 shrink-0"/>Saved IFund task: <span className="font-mono text-xs break-all">{task.id}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Preparing or opening this task does not start an AI session. Work begins after you send the copied request in ChatGPT.
        The handoff text stays out of the URL and is never sent to a third-party service by IFund.
      </p>
      <label className="block text-sm text-foreground font-medium">
        Builder request for ChatGPT
        <Textarea aria-label="Copyable ChatGPT builder request" readOnly rows={6} className="mt-1 w-full min-w-0 font-mono text-xs"
          value={prompt} onFocus={e=>e.target.select()}/>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={copy}>
          <ClipboardCopy className="w-4 h-4 mr-2"/>{copied ? "Copied request" : "Copy builder request"}
        </Button>
        <Button type="button" asChild className="min-h-11">
          <a href={CHATGPT_BUILDER_URL} target="_blank" rel="noopener noreferrer">
            Open ChatGPT <ExternalLink className="ml-2 w-4 h-4"/>
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Use the ChatGPT account with your desired plugins, paste the request, and send. IFund's internal admin chat remains separate.</p>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}
  </section>;
}
