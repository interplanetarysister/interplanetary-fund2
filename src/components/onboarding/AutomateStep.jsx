import React from "react";
import { Switch } from "@/components/ui/switch";

const TOGGLES = [
  {
    id: "cross_publish",
    title: "Cross-platform campaign publishing",
    description: "Publish a campaign once and let Crowdfund push it to connected platforms where supported.",
  },
  {
    id: "sync_updates",
    title: "Synchronized campaign updates",
    description: "Campaign updates posted in Crowdfund mirror to connected social channels automatically.",
  },
  {
    id: "unified_monitoring",
    title: "Unified campaign monitoring",
    description: "Track every fundraising effort — native and connected — from a single dashboard.",
  },
];

export default function AutomateStep({ data, onChange }) {
  const prefs = data.automation || {};
  const set = (id, val) => onChange({ ...data, automation: { ...prefs, [id]: val } });

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-display text-2xl text-stone-900 mb-2">Automate & monitor</h2>
      <p className="text-stone-600 mb-6">
        Choose what Crowdfund handles for you. You can change these anytime in Mission Control.
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