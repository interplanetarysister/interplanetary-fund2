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
import { useToast } from "@/components/ui/use-toast";
import AIInstructionsStep, { emptyAiProfile } from "@/components/campaigns/AIInstructionsStep";
import AIStoryGenerator from "@/components/campaigns/AIStoryGenerator";
import MediaUpload from "@/components/media/MediaUpload";
import { generateCampaignCoverDataUrl } from "@/lib/creditFreeGenerators";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, MapPin } from "lucide-react";

const steps = ["AI Setup", "Basics", "Story", "Launch"];

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [regenCount, setRegenCount] = useState(0);
  const [form, setForm] = useState({
    title: "", category: "other", goal_amount: "", end_date: "",
    summary: "", story: "", cover_image_url: "",
    location: "", location_lat: null, location_lng: null,
    ai_profile: emptyAiProfile, story_versions: [],
  });
  const [locating, setLocating] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const locate = async () => {
    if (!form.location) return;
    setLocating(true);
    try {
      const res = await base44.functions.invoke("geocodeCity", { city: form.location });
      const err = res.error || res.data?.error;
      if (err) throw new Error(err);
      setForm((f) => ({ ...f, location_lat: res.data.lat, location_lng: res.data.lng }));
      toast({ title: "Location found", description: (res.data.display || form.location).split(",")[0] });
    } catch {
      setForm((f) => ({ ...f, location_lat: null, location_lng: null }));
      toast({ title: "Couldn't find that city", description: "Check the city name and try again.", variant: "destructive" });
    }
    setLocating(false);
  };

  const generateCover = () => {
    setGeneratingImage(true);
    try {
      const url = generateCampaignCoverDataUrl({ title: form.title, category: form.category, regenCount });
      set("cover_image_url", url);
      setRegenCount((c) => c + 1);
    } catch {
      toast({ title: "Couldn't generate cover", description: "Please try again or upload your own image.", variant: "destructive" });
    }
    setGeneratingImage(false);
  };

  const launch = async (status) => {
    if (status === "active") {
      const missing = [];
      if (!form.title?.trim()) missing.push("title");
      if (!form.summary?.trim()) missing.push("summary");
      if (!form.story?.trim()) missing.push("story");
      if (!form.cover_image_url) missing.push("cover image");
      if (!form.end_date) missing.push("end date");
      if (!(parseFloat(form.goal_amount) > 0)) missing.push("goal amount");
      if (missing.length) {
        toast({ title: "Campaign isn't ready to launch", description: `Please add: ${missing.join(", ")}.`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const campaign = await base44.entities.Campaign.create({
        ...form,
        goal_amount: parseFloat(form.goal_amount),
        end_date: form.end_date || undefined,
        location: form.location || undefined,
        location_lat: form.location_lat || undefined,
        location_lng: form.location_lng || undefined,
        status,
      });
      base44.functions.invoke("recordCampaignCreated", { campaign_id: campaign.id }).catch(() => {});
      navigate(`/campaign/${campaign.id}`);
    } catch {
      toast({ title: "Couldn't launch campaign", description: "Please try again. If the problem continues, contact support.", variant: "destructive" });
      setSaving(false);
    }
  };

  const canNext = step === 0 ? true : step === 1 ? form.title && parseFloat(form.goal_amount) > 0 : true;

  return (
    <div className="max-w-2xl mx-auto w-full min-w-0 px-4 sm:px-6 py-8 sm:py-12 overflow-x-hidden">
      <div className="flex items-center gap-2 sm:gap-3 mb-8 min-w-0" aria-label={`Campaign setup: step ${step + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 shrink-0 ${i <= step ? "text-stone-900" : "text-stone-300"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-slate-900 text-white" : "bg-slate-100"}`}>{i + 1}</span>
              <span className="text-sm font-medium hidden sm:block">{s}</span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 min-w-2 h-px bg-stone-200" />}
          </React.Fragment>
        ))}
      </div>

      <h1 className="font-display text-3xl text-stone-900 mb-6 break-words">
        {step === 0 && "Set up your AI"}{step === 1 && "Let's set the basics"}{step === 2 && "Tell your story"}{step === 3 && "Review & launch"}
      </h1>

      <div className="bg-white rounded-2xl border border-stone-200/70 p-4 sm:p-6 shadow-sm space-y-5 min-w-0">
        {step === 0 && <AIInstructionsStep value={form.ai_profile} onChange={(p) => set("ai_profile", p)} />}

        {step === 1 && (<>
          <div className="space-y-1.5"><Label>Campaign title</Label><Input placeholder="e.g. Help Maria's Recovery Journey" value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid sm:grid-cols-2 gap-4 min-w-0">
            <div className="space-y-1.5 min-w-0"><Label>Category</Label><Select value={form.category} onValueChange={(v) => set("category", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5 min-w-0"><Label>Goal amount ($)</Label><Input type="number" min="1" placeholder="5000" value={form.goal_amount} onChange={(e) => set("goal_amount", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>End date (optional)</Label><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Location (city)</Label><div className="flex flex-col sm:flex-row gap-2 min-w-0"><Input placeholder="e.g. Portland, OR" value={form.location} onChange={(e) => set("location", e.target.value)} onBlur={locate} className="flex-1 min-w-0" /><Button type="button" variant="outline" onClick={locate} disabled={locating || !form.location} className="rounded-xl shrink-0 min-h-11">{locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Locate</Button></div><p className="text-xs text-stone-400 break-words">So supporters can find your campaign on the global globe.</p></div>
        </>)}

        {step === 2 && (<>
          <div className="space-y-1.5"><Label>Short summary</Label><Input placeholder="One sentence that captures your cause" value={form.summary} onChange={(e) => set("summary", e.target.value)} /></div>
          <AIStoryGenerator form={form} aiProfile={form.ai_profile} versions={form.story_versions} onApply={(text) => set("story", text)} onSaveVersion={(ver) => setForm((f) => ({ ...f, story_versions: [...(f.story_versions || []), ver] }))} onRestoreVersion={(ver) => set("story", ver.text)} />
          <div className="space-y-1.5"><Label>Your story</Label><Textarea rows={8} className="min-h-40 resize-y whitespace-pre-wrap break-words" placeholder="Share the background, why help is needed, and how funds will be used…" value={form.story} onChange={(e) => set("story", e.target.value)} /><p className="text-xs text-stone-400">Detailed, authentic stories build donor trust.</p></div>
          <div className="space-y-2">
            <Label>Cover image</Label>
            <Image src={form.cover_image_url || FALLBACK_IMAGE} alt={form.cover_image_url ? "Campaign cover preview" : "Default campaign cover"} className="w-full h-44 rounded-xl object-cover" />
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 min-w-0">
              <Button type="button" variant="outline" onClick={generateCover} disabled={generatingImage || !form.title} className="rounded-xl min-h-11 w-full sm:w-auto">{generatingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}{form.cover_image_url ? "Regenerate cover" : "Generate cover"}</Button>
              <div className="flex-1 min-w-0 sm:min-w-[12rem]"><MediaUpload value={form.cover_image_url} onChange={(url) => set("cover_image_url", url)} label="Upload your own photo" previewClassName="hidden" /></div>
            </div>
            <p className="text-xs text-stone-400 break-words">Upload your own photo or generate a credit-free Interplanetary Fund cover. Each regeneration gives you a fresh composition.</p>
          </div>
        </>)}

        {step === 3 && <div className="space-y-4 min-w-0">{form.cover_image_url && <Image src={form.cover_image_url} alt="Campaign cover" className="w-full h-44 rounded-xl object-cover" />}<div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wider text-primary">{categoryLabels[form.category]}</p><h2 className="font-display text-2xl text-stone-900 break-words">{form.title}</h2>{form.summary && <p className="text-stone-600 mt-1 whitespace-pre-wrap break-words">{form.summary}</p>}</div><p className="text-sm text-stone-500 break-words">Goal: <span className="font-semibold text-stone-900">${parseFloat(form.goal_amount || 0).toLocaleString()}</span>{form.end_date && ` · Ends ${form.end_date}`}</p>{form.story && <p className="text-sm text-stone-600 line-clamp-4 whitespace-pre-wrap break-words">{form.story}</p>}</div>}
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 min-w-0">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-xl min-h-11"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        {step < 3 ? <Button type="button" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={!canNext} className="bg-stone-900 hover:bg-stone-800 text-white rounded-xl min-h-11">Continue <ArrowRight className="w-4 h-4 ml-2" /></Button> : <div className="flex flex-col sm:flex-row gap-2 min-w-0"><Button type="button" variant="outline" onClick={() => launch("draft")} disabled={saving} className="rounded-xl min-h-11">Save draft</Button><Button type="button" onClick={() => launch("active")} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl min-h-11">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Launch campaign"}</Button></div>}
      </div>
    </div>
  );
}
