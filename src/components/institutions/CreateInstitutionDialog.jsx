import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { institutionTypes } from "./institutionTypes";

const empty = {
  name: "", type: "business", mission: "", industry: "", location: "", website: "",
  causes_supported: "", contact_email: "",
  offers_grants: false, offers_matching_gifts: false, offers_volunteer_program: false,
};

export default function CreateInstitutionDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const create = async () => {
    setSaving(true);
    const inst = await base44.entities.Institution.create({ ...form, verification_status: "unverified" });
    navigate(`/institutions/${inst.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          <Plus className="w-4 h-4" /> Add Institution
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Register an institution</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ridgeline Community Foundation" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(institutionTypes).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Mission</Label>
            <Textarea rows={3} value={form.mission} onChange={(e) => set("mission", e.target.value)} placeholder="What does this institution stand for?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Causes supported</Label>
            <Input value={form.causes_supported} onChange={(e) => set("causes_supported", e.target.value)} placeholder="e.g. education, food security" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email</Label>
            <Input value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label>Programs offered</Label>
            {[
              ["offers_grants", "Grants & funding programs"],
              ["offers_matching_gifts", "Matching gifts"],
              ["offers_volunteer_program", "Employee volunteer program"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-stone-600">
                <Checkbox checked={form[key]} onCheckedChange={(v) => set(key, !!v)} /> {label}
              </label>
            ))}
          </div>
          <Button onClick={create} disabled={saving || !form.name} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register institution"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}