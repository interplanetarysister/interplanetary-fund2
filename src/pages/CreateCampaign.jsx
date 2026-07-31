import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image } from "@/components/ui/image";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import { Loader2, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";

const steps = ["Basics", "Story", "Launch"];

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "other", goal_amount: "", end_date: "",
    summary: "", story: "", cover_image_url: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const generateCover = async () => {
    setGeneratingImage(true);
    const { url } = await base44.integrations.Core.GenerateImage({
      prompt: `Warm, hopeful, photorealistic cover image for a fundraising campaign titled "${form.title}" in the ${categoryLabels[form.category]} category. Soft natural light, emotionally uplifting, no text overlay.`,
    });
    set("cover_image_url", url);
    setGeneratingImage(false);
  };

  const launch = async (status) => {
    setSaving(true);
    const campaign = await base44.entities.Campaign.create({
      ...form,
      goal_amount: parseFloat(form.goal_amount),
      end_date: form.end_date || undefined,
      status,
    });
    navigate(`/campaign/${campaign.id}`);
  };

  const canNext = step === 0 ? form.title && parseFloat(form.goal_amount) > 0 : true;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${i <= step ? "text-stone-900" : "text-stone-300"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-slate-900 text-white" : "bg-slate-100"
              }`}>{i + 1}</span>
              <span className="text-sm font-medium hidden sm:block">{s}</span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-stone-200" />}
          </React.Fragment>
        ))}
      </div>

      <h1 className="font-display text-3xl text-stone-900 mb-6">
        {step === 0 && "Let's set the basics"}
        {step === 1 && "Tell your story"}
        {step === 2 && "Review & launch"}
      </h1>

      <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm space-y-5">
        {step === 0 && (<>
          <div className="space-y-1.5">
            <Label>Campaign title</Label>
            <Input placeholder="e.g. Help Maria's Recovery Journey" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Goal amount ($)</Label>
              <Input type="number" min="1" placeholder="5000" value={form.goal_amount} onChange={(e) => set("goal_amount", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>End date (optional)</Label>
            <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
        </>)}

        {step === 1 && (<>
          <div className="space-y-1.5">
            <Label>Short summary</Label>
            <Input placeholder="One sentence that captures your cause" value={form.summary} onChange={(e) => set("summary", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Your story</Label>
            <Textarea rows={8} placeholder="Share the background, why help is needed, and how funds will be used…" value={form.story} onChange={(e) => set("story", e.target.value)} />
            <p className="text-xs text-stone-400">Detailed, authentic stories build donor trust.</p>
          </div>
          <div className="space-y-2">
            <Label>Cover image</Label>
            {form.cover_image_url && <Image src={form.cover_image_url} alt="Cover preview" className="w-full h-44 rounded-xl" />}
            <Button variant="outline" onClick={generateCover} disabled={generatingImage || !form.title} className="rounded-xl">
              {generatingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}
              {form.cover_image_url ? "Regenerate with AI" : "Generate cover with AI"}
            </Button>
          </div>
        </>)}

        {step === 2 && (
          <div className="space-y-4">
            {form.cover_image_url && <Image src={form.cover_image_url} alt="Cover" className="w-full h-44 rounded-xl" />}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary">{categoryLabels[form.category]}</p>
              <h2 className="font-display text-2xl text-stone-900">{form.title}</h2>
              {form.summary && <p className="text-stone-600 mt-1">{form.summary}</p>}
            </div>
            <p className="text-sm text-stone-500">Goal: <span className="font-semibold text-stone-900">${parseFloat(form.goal_amount || 0).toLocaleString()}</span>{form.end_date && ` · Ends ${form.end_date}`}</p>
            {form.story && <p className="text-sm text-stone-600 line-clamp-4 whitespace-pre-wrap">{form.story}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="bg-stone-900 hover:bg-stone-800 text-white rounded-xl">
            Continue <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => launch("draft")} disabled={saving} className="rounded-xl">Save draft</Button>
            <Button onClick={() => launch("active")} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Launch campaign"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}