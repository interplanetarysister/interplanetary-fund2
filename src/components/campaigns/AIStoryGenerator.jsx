import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2, Wand2, History, RotateCcw, Check } from "lucide-react";
import {
  COMPLIANCE_RULES,
  STORY_STYLES,
  AUDIENCES,
  buildCampaignContext,
  styleLabel,
  audienceLabel,
} from "@/lib/campaignAI";

// AI Campaign Story Generator & Optimizer.
// Always understands the complete campaign (via buildCampaignContext) before
// generating. Supports styles, audience optimization, SEO + accessibility,
// regeneration, version history, and draft preservation. Never invents facts.
export default function AIStoryGenerator({ form, aiProfile, versions = [], onApply, onSaveVersion, onRestoreVersion }) {
  const [style, setStyle] = useState("emotional");
  const [audience, setAudience] = useState("general");
  const [seo, setSeo] = useState(true);
  const [accessibility, setAccessibility] = useState(true);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const generate = async (refine) => {
    setLoading(true);
    setError("");
    try {
      const context = buildCampaignContext(
        { ...form, story: refine && form.story ? form.story : undefined },
        aiProfile
      );
      const prompt = `You are an expert fundraising copywriter who writes truthful, high-converting campaign stories.
${COMPLIANCE_RULES}

Write a campaign story for the following campaign. Maximize donor trust, emotional connection, clarity, and conversion while remaining completely truthful.

Campaign context:
${context}

Writing requirements:
- Writing style: ${styleLabel(style)}.
- Target audience: ${audienceLabel(audience)} — tailor framing and emphasis to them.
- ${seo ? "Optimize for search: include a natural, descriptive opening sentence and relevant keywords from the context; avoid keyword stuffing." : "No SEO optimization needed."}
- ${accessibility ? "Optimize for accessibility: short paragraphs, plain language, descriptive but simple sentences, readable by screen readers, no jargon." : "Standard formatting."}
- 2–4 paragraphs, plain text, no markdown, no headings, no emoji.
- ${refine ? "Improve and refine the current story rather than replacing it wholesale; keep all facts." : "Write a fresh story."}
- Never invent facts, names, amounts, dates, or outcomes not present in the context.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: { story: { type: "string" } },
        },
      });
      const text = res.story || "";
      setDraft(text);
    } catch (e) {
      setError("Couldn't generate a story right now. Please try again.");
    }
    setLoading(false);
  };

  const apply = () => {
    if (!draft) return;
    onApply?.(draft);
    onSaveVersion?.({ text: draft, style, audience, seo, accessibility, created_date: new Date().toISOString() });
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-display text-lg text-stone-900">AI Story Generator</h3>
        </div>
        {versions.length > 0 && (
          <button onClick={() => setShowHistory((s) => !s)} className="flex items-center gap-1 text-xs text-primary font-medium hover:text-primary/80">
            <History className="w-3.5 h-3.5" /> History ({versions.length})
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Writing style</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STORY_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Target audience</Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <Switch checked={seo} onCheckedChange={setSeo} /> SEO optimization
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <Switch checked={accessibility} onCheckedChange={setAccessibility} /> Accessibility optimization
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => generate(false)} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          {form.story ? "Generate new" : "Generate story"}
        </Button>
        {form.story && (
          <Button variant="outline" onClick={() => generate(true)} disabled={loading} className="rounded-xl">
            <RotateCcw className="w-4 h-4 mr-2" /> Refine current
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft && (
        <div className="space-y-2">
          <Label className="text-xs">AI draft — review, then apply to your story</Label>
          <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} className="bg-white" />
          <div className="flex gap-2">
            <Button onClick={apply} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
              <Check className="w-4 h-4 mr-2" /> Apply to story
            </Button>
            <Button variant="outline" onClick={() => generate(false)} disabled={loading} className="rounded-xl">
              <RotateCcw className="w-4 h-4 mr-2" /> Regenerate
            </Button>
          </div>
        </div>
      )}

      {showHistory && versions.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {versions.map((ver, i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-stone-500">
                  {styleLabel(ver.style)} · {audienceLabel(ver.audience)}
                </p>
                <button onClick={() => onRestoreVersion?.(ver)} className="text-xs text-primary font-medium hover:text-primary/80">
                  Restore
                </button>
              </div>
              <p className="text-xs text-stone-600 line-clamp-3 whitespace-pre-wrap">{ver.text}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-stone-400">
        The AI uses your full campaign profile and never invents facts. You can edit anything before publishing.
      </p>
    </div>
  );
}