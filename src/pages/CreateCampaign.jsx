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
import { buildCoverPrompt } from "@/lib/coverPrompt";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, MapPin, Rocket, Coins, Wand2 } from "lucide-react";

const steps = ["Your Details", "Basics", "Campaign Story", "Launch"];

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

  const generateCover = async () => {
    setGeneratingImage(true);
    // AI image production agent: every generated cover uses the Interplanetary
    // Fund signature style (cyberpunk, afropunk, interstellar, comic) grounded
    // in the campaign's purpose. Falls back to the credit-free SVG if the AI
    // image service is unavailable so creation never blocks.
    try {
      const prompt = buildCoverPrompt({ title: form.title, category: form.category, story: form.story, regenCount });
      const res = await base44.integrations.Core.GenerateImage({ prompt });
      if (res?.url) {
        set("cover_image_url", res.url);
        setRegenCount((c) => c + 1);
        return;
      }
      throw new Error("No image returned");
    } catch {
      const url = generateCampaignCoverDataUrl({ title: form.title, category: form.category, regenCount });
      set("cover_image_url", url);
      setRegenCount((c) => c + 1);
      toast({ title: "Using a placeholder cover", description: "AI image generation was unavailable — a branded cover was created. You can upload your own or try regenerating.", variant: "default" });
    } finally {
      setGeneratingImage(false);
    }
  };

  const launch = async (status) => {
    if (status === "active") {
      const missing = [];
      if (!form.title?.trim()) missing.push("title");
      if (!form.story?.trim() && !form.summary?.trim()) missing.push("campaign story");
      if (!form.cover_image_url) missing.push("cover image");
      // End date is optional during creation; campaigns can launch without one.
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
        // Summary is optional. If the creator leaves it blank, derive the public
        // short summary from the authoritative story instead of blocking launch.
        summary: form.summary?.trim() || form.story?.trim().replace(/\s+/g, " ").slice(0, 220) || "",
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
    <div className="campaign-quest deep-space max-w-3xl mx-auto w-full min-w-0 px-4 sm:px-6 py-8 sm:py-12 overflow-x-hidden rounded-[2rem] sm:my-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-8 min-w-0" aria-label={`Campaign setup: step ${step + 1} of ${steps.length}`}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 shrink-0 ${i <= step ? "text-cyan-100" : "text-slate-500"}`}> 
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${i < step ? "bg-cyan-400 text-slate-950 border-cyan-200 shadow-[0_0_18px_rgba(34,211,238,.45)]" : i === step ? "bg-violet-500 text-white border-violet-300 shadow-[0_0_18px_rgba(139,92,246,.55)]" : "bg-slate-900 text-slate-400 border-slate-700"}`}>{i + 1}</span>
              <span className="text-sm font-medium hidden sm:block">{s}</span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 min-w-2 h-px bg-gradient-to-r from-cyan-400/50 to-violet-500/40" />}
          </React.Fragment>
        ))}
      </div>

      <h1 className="font-display text-3xl sm:text-4xl brand-gradient-text mb-2 break-words">
        {step === 0 && "Tell us what matters"}{step === 1 && "Set the campaign basics"}{step === 2 && "Choose how your story is told"}{step === 3 && "Review & launch"}
      </h1>
      <p className="text-sm text-slate-300 mb-6">{step === 0 ? "Give your campaign a spark. The AI can handle the complicated stuff." : step === 1 ? "Just the essentials. You can fine-tune the rest later." : step === 2 ? "Pick a vibe, create your story, then make it yours." : "One last look before your campaign enters orbit."}</p>

      <div className="glass-panel rounded-[1.75rem] p-4 sm:p-6 shadow-[0_20px_70px_rgba(2,6,23,.45)] space-y-5 min-w-0">
        {step === 0 && <AIInstructionsStep value={form.ai_profile} onChange={(p) => set("ai_profile", p)} />}

        {step === 1 && (<div className="space-y-5">
          <div className="flex items-center gap-3"><span className="quest-icon"><Rocket className="w-5 h-5" /></span><div><h2 className="text-xl font-bold text-white">Launch basics</h2><p className="text-sm text-slate-300">Three quick choices. No paperwork energy.</p></div></div>
          <div className="space-y-2"><Label className="quest-label">What should we call your mission?</Label><Input className="quest-input" placeholder="Give your campaign a name…" value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="space-y-2 min-w-0"><Label className="quest-label">What kind?</Label><Select value={form.category} onValueChange={(v) => set("category", v)}><SelectTrigger className="quest-input"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 min-w-0"><Label className="quest-label flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Goal</Label><Input className="quest-input" type="number" min="1" placeholder="$5,000" value={form.goal_amount} onChange={(e) => set("goal_amount", e.target.value)} /></div>
          </div>
          <details className="rounded-2xl border border-violet-400/25 bg-violet-500/10 overflow-hidden group"><summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-sm font-semibold text-violet-100"><span className="flex items-center gap-2"><Wand2 className="w-4 h-4 text-cyan-300" /> Add extras <span className="font-normal text-slate-400">(optional)</span></span><span className="text-cyan-300 group-open:rotate-45 transition-transform">+</span></summary><div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/10"><div className="space-y-2"><Label className="quest-label">Deadline</Label><Input className="quest-input" type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></div><div className="space-y-2"><Label className="quest-label">Where is this happening?</Label><div className="flex gap-2 min-w-0"><Input className="quest-input flex-1 min-w-0" placeholder="City, state" value={form.location} onChange={(e) => set("location", e.target.value)} onBlur={locate} /><Button type="button" variant="outline" onClick={locate} disabled={locating || !form.location} className="quest-button shrink-0">{locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}<span className="hidden sm:inline ml-1">Find</span></Button></div></div></div></details>
        </div>)}

        {step === 2 && (<>
          <div className="rounded-2xl border border-violet-300/25 bg-violet-500/10 p-4 sm:p-5 space-y-2"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Your signal</p><Label className="quest-label text-base">Sum it up in one line</Label></div><Input className="quest-input" placeholder="What are you trying to make happen?" value={form.summary} onChange={(e) => set("summary", e.target.value)} /><p className="text-xs text-slate-400">Optional. Your words stay yours; if left blank, a short public summary is created from your final story when you launch.</p></div>
          <AIStoryGenerator form={form} aiProfile={form.ai_profile} versions={form.story_versions} onApply={(text) => set("story", text)} onSaveVersion={(ver) => setForm((f) => ({ ...f, story_versions: [...(f.story_versions || []), ver] }))} onRestoreVersion={(ver) => set("story", ver.text)} />
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-4 sm:p-5 space-y-2"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Final transmission</p><Label className="quest-label text-base">Your campaign story</Label></div><Textarea rows={10} className="quest-input min-h-56 resize-y whitespace-pre-wrap break-words" placeholder="Write it yourself or forge a draft above, then remix it here." value={form.story} onChange={(e) => set("story", e.target.value)} /><p className="text-xs text-slate-400">This is the one story that goes live. Story Forge edits this same field and keeps earlier versions available to restore.</p></div>
          <div className="space-y-2">
            <Label className="quest-label">Campaign art</Label>
            <Image src={form.cover_image_url || FALLBACK_IMAGE} alt={form.cover_image_url ? "Campaign cover preview" : "Default campaign cover"} className="w-full h-44 rounded-xl object-cover" />
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 min-w-0">
              <Button type="button" variant="outline" onClick={generateCover} disabled={generatingImage || !form.title} className="quest-button w-full sm:w-auto">{generatingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}{form.cover_image_url ? "Regenerate cover" : "Generate cover"}</Button>
              <div className="flex-1 min-w-0 sm:min-w-[12rem]"><MediaUpload value={form.cover_image_url} onChange={(url) => set("cover_image_url", url)} label="Upload your own photo" previewClassName="hidden" /></div>
            </div>
            <p className="text-xs text-slate-400 break-words">Bring your own image or let Interplanetary Fund generate a fresh comic-space cover.</p>
          </div>
        </>)}

        {step === 3 && <div className="space-y-4 min-w-0 text-slate-200">{form.cover_image_url && <Image src={form.cover_image_url} alt="Campaign cover" className="w-full h-44 rounded-xl object-cover" />}<div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wider text-primary">{categoryLabels[form.category]}</p><h2 className="font-display text-2xl text-white break-words">{form.title}</h2>{form.summary && <p className="text-slate-300 mt-1 whitespace-pre-wrap break-words">{form.summary}</p>}</div><p className="text-sm text-slate-300 break-words">Goal: <span className="font-semibold text-cyan-200">${parseFloat(form.goal_amount || 0).toLocaleString()}</span>{form.end_date && ` · Ends ${form.end_date}`}</p>{form.story && <details className="rounded-2xl border border-white/10 bg-slate-950/35 p-4" open><summary className="cursor-pointer text-sm font-semibold text-cyan-200 mb-2">Campaign story</summary><p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{form.story}</p></details>}</div>}
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 min-w-0">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="quest-button"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        {step < 3 ? <Button type="button" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={!canNext} className="rounded-2xl min-h-12 bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-bold hover:opacity-90">Continue <ArrowRight className="w-4 h-4 ml-2" /></Button> : <div className="flex flex-col sm:flex-row gap-2 min-w-0"><Button type="button" variant="outline" onClick={() => launch("draft")} disabled={saving} className="quest-button">Save draft</Button><Button type="button" onClick={() => launch("active")} disabled={saving} className="rounded-2xl min-h-12 bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-bold hover:opacity-90">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Launch campaign"}</Button></div>}
      </div>
    </div>
  );
}