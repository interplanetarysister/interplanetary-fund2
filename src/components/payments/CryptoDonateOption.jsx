import React, { useRef, useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { MIN_DONATION } from "@/lib/fees";

// Crypto gifts go through the provider's hosted checkout, which is only
// offered when the provider itself reports crypto approved and settled. The
// browser return never credits a campaign: the signed webhook does.
export default function CryptoDonateOption({
  campaign = null, amount = "", platformContribution = false,
  available = false, reason = "",
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const intentRef = useRef({ key: "", id: "" });

  const optedIn = campaign?.accept_crypto_donations === true;
  const value = Number(amount) || 0;

  if (!optedIn) return null;

  const start = async () => {
    setError("");
    if (!(value >= MIN_DONATION)) { setError(`Enter at least $${MIN_DONATION} to give with crypto.`); return; }
    const key = [campaign.id, value.toFixed(2), platformContribution ? "1" : "0"].join("|");
    if (intentRef.current.key !== key) intentRef.current = { key, id: crypto.randomUUID() };
    setStarting(true);
    try {
      const { data } = await base44.functions.invoke("createCryptoDonationCheckout", {
        campaign_id: campaign.id,
        amount: value,
        platform_contribution: platformContribution === true,
        intent_id: intentRef.current.id,
      });
      if (!data?.url) throw new Error("unavailable");
      const target = new URL(data.url);
      if (target.protocol !== "https:" || !/(^|\.)stripe\.com$/.test(target.hostname)) {
        throw new Error("unexpected_redirect");
      }
      window.location.assign(target.href);
    } catch (e) {
      const message = e?.response?.data?.error || e?.data?.error || "";
      setError(message || "Crypto checkout could not start. You were not charged.");
      setStarting(false);
    }
  };

  return (
    <section
      className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-slate-950 dark:border-violet-500 dark:bg-slate-900 dark:text-slate-50"
      aria-label="Cryptocurrency donations"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
        <Wallet className="w-4 h-4" /> Cryptocurrency donations
      </h3>
      {available ? (
        <>
          <p className="mt-2 text-xs text-violet-900/80 dark:text-violet-100/80">
            Pay with crypto on the verified payment processor's secure page. Your gift is added to this campaign only after the payment is confirmed.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full border-violet-400 bg-white text-violet-950 hover:bg-violet-100 dark:bg-slate-950 dark:text-violet-100"
            onClick={start}
            disabled={starting}
          >
            {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wallet className="w-4 h-4 mr-2" />}
            {starting ? "Opening crypto checkout…" : "Give with crypto"}
          </Button>
          {error && <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-200">{error}</p>}
        </>
      ) : (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-400/30 dark:bg-amber-200/10 dark:text-amber-100">
          Not available yet. {reason || "Crypto gifts open once the payment provider verifies this platform for crypto settlement."}
        </p>
      )}
    </section>
  );
}