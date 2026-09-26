import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldOff, Sparkles } from "lucide-react";

// The AI Authorization agreement. AI never publishes to a connected campaign or
// social account without this explicit, revocable license — and even with it,
// per-platform automation settings still govern every destination.
export default function AIConsentCard({ user, onChanged, onConnectionChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const consent = user?.ai_publishing_consent;
  const connectionConsent = user?.ai_connection_consent;

  const decide = async (granted) => {
    setSaving(true);
    const value = { granted, decided_at: new Date().toISOString() };
    try {
      await base44.auth.updateMe({ ai_publishing_consent: value });
      onChanged(value);
      setError("");
    } catch {
      setError("Couldn't save your choice. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const decideConnection = async (granted) => {
    setSaving(true);
    try {
      const value = { granted, decided_at: new Date().toISOString() };
      await base44.auth.updateMe({ ai_connection_consent: value });
      onConnectionChanged(value);
      setError("");
    } catch {
      setError("Couldn't save your choice. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
        <Sparkles className="w-3.5 h-3.5" /> AI help
      </p>
      <p className="text-sm text-stone-600">
        Grant Interplanetary Fund's AI a license to prepare and publish content to the campaigns
        and social accounts you connect. AI never posts anywhere without your permission, follows
        the choice you make for each platform. You can turn this off anytime.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {consent?.granted ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <ShieldCheck className="w-4 h-4" /> Authorized {consent.decided_at ? `· ${new Date(consent.decided_at).toLocaleDateString()}` : ""}
            </span>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => decide(false)} className="rounded-xl">Turn off</Button>
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
      <div className="mt-5 pt-4 border-t border-stone-200">
        <p className="text-sm font-semibold text-stone-900">Let AI help connect platforms</p>
        <p className="text-xs text-stone-600 mt-1">When you ask in chat, your agent can prepare a new connection and open provider sign-in. You can turn this off anytime. Payments and withdrawals are separate.</p>
        <Button size="sm" variant={connectionConsent?.granted ? "outline" : "default"} disabled={saving} onClick={() => decideConnection(!connectionConsent?.granted)} className="mt-3 rounded-xl">
          {connectionConsent?.granted ? "On · Turn off" : "Turn on"}
        </Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}