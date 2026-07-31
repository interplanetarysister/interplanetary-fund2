import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";

// Card + Google Pay donations go through Stripe Checkout, which automatically
// surfaces Google Pay (and Apple Pay / Link) on supported browsers. The
// checkout.session.completed webhook records the donation in the ledger.
export default function StripeDonateButton({ campaign, amount, donorName, message, recurring, label }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) { setError("Enter an amount first."); return; }
    if (window.self !== window.top) {
      setError("Checkout only works from the published app. Open the campaign in a new tab to pay.");
      return;
    }
    setLoading(true); setError("");
    try {
      const { data } = await base44.functions.invoke("createDonationCheckout", {
        campaign_id: campaign.id,
        amount: value,
        donor_name: donorName || "Anonymous",
        message,
        is_recurring: !!recurring,
        origin: window.location.origin,
      });
      if (data?.url) { window.location.href = data.url; return; }
      setError("Couldn't start checkout. Please try again.");
    } catch (e) {
      setError("Couldn't start checkout. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div>
      <Button onClick={pay} disabled={loading || !amount} className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
        {label || "Pay with card or Google Pay"}
      </Button>
      {error && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
    </div>
  );
}