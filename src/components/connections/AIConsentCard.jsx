import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldOff, Sparkles } from "lucide-react";

// Standing OBO authorization for user-directed delegated execution. IFund software
// performs covered tasks as the user's authorized extension; provider capabilities
// and per-connection preferences still govern what can technically execute.
export default function AIConsentCard({ user, onChanged, onConnectionChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const consent = user?.ai_obo_consent || user?.ai_publishing_consent || user?.ai_connection_consent;

  const decide = async (granted) => {
    setSaving(true);
    try {
      const result = await base44.functions.invoke("setUnifiedOboConsent", { granted });
      const value = result?.data?.consent || { granted, decided_at: new Date().toISOString() };
      onChanged?.(value);
      onConnectionChanged?.(value);
      setError("");
    } catch {
      setError("Couldn't save your AI authorization. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
        <Sparkles className="w-3.5 h-3.5" /> Delegated operation
      </p>
      <p className="text-sm text-stone-600">
        Turn this on once if you want IFund to do covered steps for you. After that, tapping Connect, Create account, or Publish tells IFund what you want done. IFund will not keep asking for the same permission. Turn it off anytime and those outside-account steps become manual again.
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
                <ShieldOff className="w-4 h-4" /> Not authorized — IFund will not act for you
              </span>
            )}
            <Button size="sm" disabled={saving} onClick={() => decide(true)} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">Authorize IFund</Button>
            {!consent && (
              <Button size="sm" variant="outline" disabled={saving} onClick={() => decide(false)} className="rounded-xl">Deny</Button>
            )}
          </>
        )}
      </div>
      <div className="mt-5 pt-4 border-t border-stone-200">
        <p className="text-sm font-semibold text-stone-900">One simple permission</p>
        <p className="text-xs text-stone-600 mt-1">When this is on, Connect can connect an account, Create account can set up an eligible outside account, and Publish can share to eligible connected accounts. When it is off, you connect, manage, and post to outside accounts yourself.</p>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}