import React from "react";
import { Switch } from "@/components/ui/switch";

const TOGGLES = [
  {
    id: "cross_publish",
    title: "Share campaign updates",
    description: "Write an update once and share it to the places you connected.",
  },
  {
    id: "sync_updates",
    title: "Keep updates together",
    description: "Let Interplanetary Fund keep your connected pages up to date.",
  },
  {
    id: "unified_monitoring",
    title: "See everything together",
    description: "See your Interplanetary Fund and connected fundraisers in one place.",
  },
];

export default function AutomateStep({ data, onChange }) {
  const prefs = data.automation || {};
  const set = (id, val) => onChange({ ...data, automation: { ...prefs, [id]: val } });

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-display text-2xl text-stone-900 mb-2">Choose what gets help</h2>
      <p className="text-stone-600 mb-6">
        Choose what Interplanetary Fund may help with. You can change this anytime.
      </p>
      <div className="space-y-3">
        {TOGGLES.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-4 bg-white rounded-xl border border-stone-200 p-4">
            <div>
              <p className="font-medium text-stone-800 text-sm">{t.title}</p>
              <p className="text-xs text-stone-500">{t.description}</p>
            </div>
            <Switch checked={!!prefs[t.id]} onCheckedChange={(v) => set(t.id, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}