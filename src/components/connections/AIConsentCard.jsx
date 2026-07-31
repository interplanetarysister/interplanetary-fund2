import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldOff, Sparkles } from "lucide-react";

// The AI Authorization agreement. AI never publishes to a connected campaign or
// social account without this explicit, revocable license — and even with it,
// per-platform automation settings still govern every destination.
export default function AIConsentCard({ user, onChanged }) {
  const [saving, setSaving] = useState(false);
  const consent = user?.ai_publishing_consent;

  const decide = async (granted) => {
    setSaving(true);
    const value = { granted, decided_at: new Date().toISOString() };
    await base44.auth.updateMe({ ai_publishing_consent: value });
    onChanged(value);
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
        <Sparkles className="w-3.5 h-3.5" /> AI Publishing Authorization
      </p>
      <p className="text-sm text-stone-600">
        Grant Interplanetary Fund's AI a license to prepare and publish content to the campaigns
        and social accounts you connect. AI never posts anywhere without your permission, follows
        the automation setting you choose for each platform, and you can revoke this at any time.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {consent?.granted ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <ShieldCheck className="w-4 h-4" /> Authorized {consent.decided_at ? `· ${new Date(consent.decided_at).toLocaleDateString()}` : ""}
            </span>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => decide(false)} className="rounded-xl">Revoke authorization</Button>
          </>
        ) : (
          <>
            {consent && !consent.granted && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500">
                <ShieldOff className="w-4 h-4" /> Not authorized — AI will never publish for you
              </span>
            )}
            <Button size="sm" disabled={saving} onClick={() => decide(true)} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">Accept</Button>
            {!consent && (
              <Button size="sm" variant="outline" disabled={saving} onClick={() => decide(false)} className="rounded-xl">Deny</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}