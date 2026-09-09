import React, { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

const SAFE_ADMIN_ERROR = "This action is temporarily unavailable until the server-side admin workflow is enabled.";

// Fraud Control Panel — admin-only UI.
// Privileged queue reads and state changes are fail-closed until they are served by an
// authenticated, server-authoritative moderation projection/action boundary.
export default function FraudControlPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setError(SAFE_ADMIN_ERROR);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-rose-500" />
        <h2 className="font-display text-xl text-stone-900">Fraud Control</h2>
      </div>

      {error && <p role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{error}</p>}

      <section className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
        <h3 className="font-medium text-stone-800 mb-2">Admin moderation unavailable</h3>
        <p className="text-sm text-stone-600">
          The fraud queue, campaign moderation controls, and payout decisions are intentionally unavailable in the browser until an authenticated server-side projection and action boundary is deployed.
        </p>
        <p className="text-xs text-stone-500 mt-3">
          This prevents direct client-side enumeration or mutation of Withdrawal/Campaign records and avoids bypassing claim, idempotency, ledger, and audit controls.
        </p>
      </section>
    </div>
  );
}
