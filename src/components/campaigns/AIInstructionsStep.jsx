import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";

// The campaign's permanent AI profile. Every question is optional so the
// creator can skip now and edit later. These answers are reused by every AI
// feature (story generator, outreach agent, recommendations) to represent
// the campaign consistently and truthfully.
const TONES = ["Warm", "Emotional", "Hopeful", "Professional", "Urgent", "Factual", "Conversational"];
const PRIORITIES = [
  { value: "emotional", label: "Emotional storytelling" },
  { value: "factual", label: "Factual presentation" },
  { value: "urgent", label: "Urgency" },
  { value: "professional", label: "Professionalism" },
  { value: "community", label: "Community involvement" },
];
const PLATFORMS = ["Facebook", "Instagram", "TikTok", "LinkedIn", "Twitter/X", "Email", "Other"];

export const emptyAiProfile = {
  primary_goal: "",
  who_helping: "",
  ideal_donors: "",
  tone: "",
  never_change: "",
  always_emphasize: "",
  platforms: [],
  interested_orgs: "",
  avoid_words: "",
  priority: "",
  long_term_outcome: "",
};

export default function AIInstructionsStep({ value, onChange }) {
  const v = { ...emptyAiProfile, ...(value || {}) };
  const set = (k, val) => onChange({ ...v, [k]: val });
  const togglePlatform = (p) =>
    set("platforms", v.platforms.includes(p) ? v.platforms.filter((x) => x !== p) : [...v.platforms, p]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </span>
        <div>
          <h2 className="font-display text-xl text-stone-900">Set up your AI</h2>
          <p className="text-sm text-stone-500">
            Help the AI understand how to represent and promote this campaign. All questions are optional —
            you can skip and edit these anytime.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="What is your primary fundraising goal?">
          <Input value={v.primary_goal} onChange={(e) => set("primary_goal", e.target.value)} placeholder="e.g. $10,000 for surgery recovery" />
        </Field>
        <Field label="Who is this campaign helping?">
          <Input value={v.who_helping} onChange={(e) => set("who_helping", e.target.value)} placeholder="e.g. Maria, a single mother of two" />
        </Field>
        <Field label="Who do you believe your ideal donors are?">
          <Input value={v.ideal_donors} onChange={(e) => set("ideal_donors", e.target.value)} placeholder="e.g. local community, healthcare workers" />
        </Field>
        <Field label="What tone would you like the AI to use?">
          <Select value={v.tone} onValueChange={(val) => set("tone", val)}>
            <SelectTrigger><SelectValue placeholder="Choose a tone" /></SelectTrigger>
            <SelectContent>
              {TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Should the AI prioritize…">
          <Select value={v.priority} onValueChange={(val) => set("priority", val)}>
            <SelectTrigger><SelectValue placeholder="Choose a priority" /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Organizations, communities, or industries that may be interested">
          <Input value={v.interested_orgs} onChange={(e) => set("interested_orgs", e.target.value)} placeholder="e.g. local churches, Rotary clubs" />
        </Field>
      </div>

      <Field label="What details should never be changed?">
        <Textarea rows={2} value={v.never_change} onChange={(e) => set("never_change", e.target.value)} placeholder="Facts the AI must always keep exactly as stated." />
      </Field>
      <Field label="What information should always be emphasized?">
        <Textarea rows={2} value={v.always_emphasize} onChange={(e) => set("always_emphasize", e.target.value)} placeholder="Key points to highlight in every message." />
      </Field>
      <Field label="Are there words or topics that should be avoided?">
        <Textarea rows={2} value={v.avoid_words} onChange={(e) => set("avoid_words", e.target.value)} placeholder="Anything the AI should not mention." />
      </Field>
      <Field label="What long-term outcome are you hoping this campaign achieves?">
        <Textarea rows={2} value={v.long_term_outcome} onChange={(e) => set("long_term_outcome", e.target.value)} placeholder="e.g. full recovery and return to work" />
      </Field>

      <Field label="What platforms do you plan to share on?">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = v.platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-stone-600 hover:border-slate-300"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-stone-700">{label}</Label>
      {children}
    </div>
  );
}