import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { secureInvokeLLM } from "@/lib/secureLLM";
import { buildCampaignContext, COMPLIANCE_RULES } from "@/lib/campaignAI";
import { titleCase } from "@/components/insights/donutData";
import { Loader2, Sparkles, ArrowRight, Bot } from "lucide-react";

const OUTLINE = "rounded-2xl border border-cyan-400/40 bg-[#09132c] p-5 text-slate-100";
const BUTTON = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60";

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    overview: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } },
  },
  required: ["overview"],
};

const AGENT_PREVIEW = [
  {
    role: "You",
    text: "Which of my live campaigns is closest to its goal, and what should I do next?",
  },
  {
    role: "NEXUS (Chief of Staff)",
    text: "Your storm relief campaign is furthest along. I'd route the next supporter update to ECHO and an outreach recommendation to PULSE — you approve both before anything sends.",
  },
];

function ResultList({ title, items, tone }) {
  const rows = (Array.isArray(items) ? items : []).filter((item) => typeof item === "string" && item.trim());
  if (!rows.length) return null;
  return <div>
    <h4 className={"text-xs font-bold uppercase tracking-wide " + tone}>{title}</h4>
    <ul className="mt-2 space-y-1.5">
      {rows.slice(0, 4).map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>;
}

// The demo's visible AI layer. The campaign review runs against live records
// through the same gated LLM gateway the product uses; the agent exchange is a
// labelled preview that links to the real assistant.
export default function AIExperience({ campaigns = [], loading }) {
  const live = Array.isArray(campaigns) ? campaigns : [];
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => live.find((campaign) => campaign.id === selectedId) || live[0] || null,
    [live, selectedId],
  );

  async function analyze() {
    if (!selected || busy) return;
    setBusy(true);
    setReview(null);
    setMessage("");
    try {
      const result = await secureInvokeLLM({
        task: `${COMPLIANCE_RULES}\nYou are reviewing one published fundraising campaign for its organizer. Use ONLY the campaign data supplied. Return a plain overview sentence, up to three strengths, up to three risks or missing details, and up to three concrete next steps. Never invent facts, donor identities, or outcomes.`,
        untrusted: [buildCampaignContext(selected, selected.ai_profile)],
        response_json_schema: REVIEW_SCHEMA,
      });
      setReview(result);
    } catch {
      setMessage("The live AI review needs a signed-in account. Sign in, then run it again on any real campaign.");
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Live AI experience" className="space-y-4">
    <div className="rounded-3xl border border-cyan-400/50 bg-gradient-to-br from-[#0b1a3a] to-[#080e23] p-5 sm:p-7">
      <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
        <Sparkles className="h-3.5 w-3.5" /> AI is live, not a screenshot
      </p>
      <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Ask the AI about a real campaign</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
        Pick any live published campaign and the assistant reviews it through Interplanetary Fund's own AI gateway — the same gated service that writes campaign copy. This is not scripted output.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <label htmlFor="ai-campaign" className="text-sm font-semibold text-slate-200">Live campaign to review</label>
          {loading ? <p role="status" className="mt-3 text-sm text-slate-400">Loading live campaigns…</p>
            : live.length === 0 ? <p className="mt-3 text-sm text-slate-400">No published campaigns are available to review yet.</p>
            : <select
              id="ai-campaign"
              value={selected?.id || ""}
              onChange={(event) => { setSelectedId(event.target.value); setReview(null); setMessage(""); }}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-base text-white"
            >
              {live.slice(0, 60).map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {(campaign.title || "Untitled") + " · " + titleCase(campaign.category)}
                </option>
              ))}
            </select>}
          {selected && <p className="mt-3 text-xs leading-5 text-slate-400">
            {selected.location ? selected.location + " · " : ""}
            Goal ${Number(selected.goal_amount || 0).toLocaleString()} · Raised ${Number(selected.raised_amount || 0).toLocaleString()} · {Number(selected.donor_count || 0)} donors
          </p>}
          <button type="button" onClick={analyze} disabled={!selected || busy} className={BUTTON + " mt-4 w-full"}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Reviewing live campaign…" : "Run live AI review"}
          </button>
          {message && <p role="alert" className="mt-3 rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-xs text-amber-100">
            {message} <Link to="/login" className="underline">Sign in</Link>
          </p>}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Assistant review</h3>
          {!review && !busy && <p className="mt-3 text-sm leading-6 text-slate-400">
            The review returns an overview, strengths, risks and next steps built only from this campaign's own details.
          </p>}
          {busy && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the campaign…
          </p>}
          {review && <div className="mt-3 space-y-4">
            {review.overview && <p className="text-sm leading-6 text-slate-200">{review.overview}</p>}
            <ResultList title="Strengths" items={review.strengths} tone="text-emerald-300" />
            <ResultList title="Risks and gaps" items={review.risks} tone="text-amber-300" />
            <ResultList title="Next steps" items={review.next_steps} tone="text-cyan-300" />
            <p className="text-xs text-slate-500">AI guidance only. It never changes a campaign or publishes anything.</p>
          </div>}
        </div>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div className={OUTLINE}>
        <h3 className="flex items-center gap-2 text-lg font-bold text-white"><Bot className="h-5 w-5 text-cyan-300" /> Chatting with agents</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Every member gets a specialist team. The Chief of Staff coordinates and each specialist handles one domain — outreach, communications, growth, strategy.
        </p>
        <div className="mt-4 space-y-3" aria-label="Example agent conversation">
          {AGENT_PREVIEW.map((row) => <p key={row.role} className={
            "whitespace-pre-wrap break-words rounded-xl border p-3 text-sm leading-6 " +
            (row.role === "You" ? "border-violet-300/30 bg-violet-400/10 text-violet-100"
              : "border-cyan-300/30 bg-cyan-400/10 text-cyan-50")
          }>
            <strong className="block text-xs uppercase tracking-wide opacity-80">{row.role}</strong>
            {row.text}
          </p>)}
        </div>
        <p className="mt-3 text-xs text-slate-400">Illustrative transcript of the real agent flow. Open your AI team to hold the actual conversation.</p>
        <Link to="/agents" className={BUTTON + " mt-4 w-full"}>Open the AI team <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <div className={OUTLINE}>
        <h3 className="flex items-center gap-2 text-lg font-bold text-white"><Sparkles className="h-5 w-5 text-cyan-300" /> The AI that does the work: campaign creation</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Campaign creation is the fully functioning assistant. Describe what you are raising funds for and it produces five title choices, two descriptions, a full editable story, and an illustration — or you can speak your campaign aloud.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {["Five distinct titles and two descriptions to choose from",
            "A complete story you edit before anything is published",
            "AI cover illustration in the IFund style",
            "Guided voice walkthrough — purpose, who it helps, your own goal"].map((line) =>
            <li key={line} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" /><span>{line}</span></li>)}
        </ul>
        <Link to="/create" className={BUTTON + " mt-4 w-full"}>Start a campaign with the AI <ArrowRight className="h-4 w-4" /></Link>
        <p className="mt-3 text-xs text-slate-400">Nothing publishes without your approval.</p>
      </div>
    </div>
  </section>;
}