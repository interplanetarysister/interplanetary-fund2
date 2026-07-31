import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logPlatformEvent } from "./logPlatformEvent";
import { Loader2, Plus } from "lucide-react";

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: "", label: "", description: "", scope: "global" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.FeatureFlag.list("-created_date", 100).then(setFlags);
  }, []);

  if (!flags) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-orange-600" /></div>;
  }

  const create = async () => {
    setSaving(true);
    const flag = await base44.entities.FeatureFlag.create({ ...form, enabled: false });
    await logPlatformEvent({
      action: "Feature flag created",
      category: "configuration",
      affected_resource: flag.key,
      details: `Scope: ${flag.scope}`,
    });
    setFlags((prev) => [flag, ...prev]);
    setForm({ key: "", label: "", description: "", scope: "global" });
    setShowForm(false);
    setSaving(false);
  };

  const toggle = async (flag, enabled) => {
    setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled } : f)));
    await base44.entities.FeatureFlag.update(flag.id, { enabled });
    await logPlatformEvent({
      action: `Feature flag ${enabled ? "enabled" : "disabled"}`,
      category: "configuration",
      affected_resource: flag.key,
      details: `Changed by administrator — reversible at any time.`,
    });
  };

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
          <Plus className="w-4 h-4" /> New flag
        </Button>
      )}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="flag_key" />
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Display label" />
          </div>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this flag control?" />
          <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
              <SelectItem value="experiment">Experiment</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={create} disabled={saving || !form.key} className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      )}

      {flags.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">No feature flags configured yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
          {flags.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-stone-900">{f.label || f.key}</p>
                  <Badge variant="secondary" className="capitalize">{f.scope}</Badge>
                </div>
                <p className="text-xs font-mono text-stone-400 mt-0.5">{f.key}</p>
                {f.description && <p className="text-xs text-stone-500 mt-1">{f.description}</p>}
              </div>
              <Switch checked={f.enabled} onCheckedChange={(v) => toggle(f, v)} aria-label={`Toggle ${f.label || f.key}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}