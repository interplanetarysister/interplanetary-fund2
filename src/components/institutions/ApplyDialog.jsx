import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

export default function ApplyDialog({ opportunity, institution, onApplied }) {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [narrative, setNarrative] = useState("");
  const [amount, setAmount] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const me = await base44.auth.me();
      setCampaigns(await base44.entities.Campaign.filter({ created_by_id: me.id }));
    })();
  }, [open]);

  const campaign = campaigns.find((c) => c.id === campaignId);

  const draft = async () => {
    setDrafting(true);
    const text = await base44.integrations.Core.InvokeLLM({
      prompt: `Write a concise, compelling grant application narrative (about 200 words) for this opportunity.
Opportunity: ${opportunity.title} from ${institution.name}
Description: ${opportunity.description || "n/a"}
Eligibility: ${opportunity.eligibility || "n/a"}
Applying campaign: "${campaign?.title}" — ${campaign?.summary || ""}
Campaign story: ${(campaign?.story || "").slice(0, 1500)}
Raised so far: $${campaign?.raised_amount || 0} of $${campaign?.goal_amount || 0} goal.
Write in first person plural, specific and evidence-based. Return only the narrative text.`,
    });
    setNarrative(text);
    setDrafting(false);
  };

  const submit = async () => {
    setSaving(true);
    const me = await base44.auth.me();
    const app = await base44.entities.GrantApplication.create({
      opportunity_id: opportunity.id,
      opportunity_title: opportunity.title,
      institution_id: institution.id,
      institution_name: institution.name,
      campaign_id: campaignId,
      campaign_title: campaign?.title,
      applicant_name: me.full_name || me.email,
      applicant_user_id: me.id,
      narrative,
      requested_amount: amount ? Number(amount) : undefined,
      status: "submitted",
    });
    await base44.entities.InstitutionOpportunity.update(opportunity.id, {
      application_count: (opportunity.application_count || 0) + 1,
    });
    if (opportunity.created_by_id && opportunity.created_by_id !== me.id) {
      await base44.entities.Notification.create({
        user_id: opportunity.created_by_id,
        title: "New application received",
        body: `${campaign?.title} applied to "${opportunity.title}"`,
        type: "system",
        link: `/institutions/${institution.id}`,
      });
    }
    onApplied(app);
    setOpen(false);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white rounded-lg">Apply</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Apply — {opportunity.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Campaign</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger><SelectValue placeholder="Select a campaign" /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {campaigns.length === 0 && <p className="text-xs text-stone-400">You need a campaign before applying.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Requested amount (optional)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Narrative</Label>
              <Button size="sm" variant="ghost" onClick={draft} disabled={drafting || !campaignId} className="text-orange-600 hover:text-orange-500 h-7">
                {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI draft
              </Button>
            </div>
            <Textarea rows={8} value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder="Why this campaign is a strong fit…" />
            <p className="text-xs text-stone-400">AI drafts are suggestions — review and edit before submitting.</p>
          </div>
          <Button onClick={submit} disabled={saving || !campaignId || !narrative.trim()} className="w-full bg-orange-600 hover:bg-orange-500 text-white h-11 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit application"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}