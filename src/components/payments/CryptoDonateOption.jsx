import React, { useEffect, useState } from "react";
import { Wallet, Loader2, ShieldAlert, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { reownConfigured, openReownWallet } from "@/lib/reownWallet";

// A connected wallet never initiates a transfer or credits a campaign.
// For approved merchants Stripe handles checkout, currency conversion and
// payment confirmation. Only Stripe's signed webhook can credit the ledger.
export default function CryptoDonateOption({
  campaign = null, platformSupport = false, amount = "", donorName = "",
  message = "", platformContribution = false,
}) {
  const [readiness, setReadiness] = useState(null);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const optedIn = platformSupport || campaign?.accept_crypto_donations === true;

  useEffect(() => {
    if (!optedIn) return undefined;
    let active = true;
    setChecking(true);
    base44.functions.invoke("getCryptoDonationReadiness", {})
      .then(({ data }) => { if (active) setReadiness(data?.crypto || null); })
      .catch(() => { if (active) setReadiness(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [optedIn]);

  if (!optedIn) return null;

  const connect = async () => {
    setConnecting(true);
    setError("");
    try { await openReownWallet(); }
    catch { setError("Wallet connection is unavailable right now. No funds were sent."); }
    finally { setConnecting(false); }
  };

  const checkout = async () => {
    const number = Number(amount);
    if (!campaign?.id || readiness?.verified_checkout_live !== true) {
      setError("Crypto donation checkout is not ready.");
      return;
    }
    if (!Number.isFinite(number) || number < 1 || number > 10000) {
      setError("Enter a valid donation amount first.");
      return;
    }
    setPaying(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("createDonationCheckout", {
        campaign_id: campaign.id, amount: number, donor_name: donorName,
        message, is_recurring: false, payment_rail: "stripe_crypto",
        origin: window.location.origin, platform_contribution: !!platformContribution,
      });
      const url = String(data?.url || "");
      const link = new URL(url);
      if (link.protocol !== "https:" || link.hostname !== "checkout.stripe.com") {
        throw new Error("Unverified checkout URL.");
      }
      window.location.assign(url);
    } catch {
      setError("Could not open a verified crypto checkout. No payment has been started.");
    } finally { setPaying(false); }
  };

  const ready = readiness?.verified_checkout_live === true && readiness?.settlement_ready === true;

  return (
    <section className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-slate-950 dark:border-violet-500 dark:bg-slate-900 dark:text-slate-50" aria-label="Cryptocurrency donations">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-900 dark:text-violet-100"><Wallet className="w-4 h-4" /> Donate cryptocurrency</h3>
      <p className="mt-1 text-sm leading-relaxed text-violet-950 dark:text-slate-100">
        {platformSupport
          ? "Interplanetary Fund is preparing a verified cryptocurrency donation option."
          : "The campaign creator has chosen to accept cryptocurrency when secure payment processing is available."}
      </p>
      <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-700/20 bg-amber-50 p-2.5 text-sm leading-relaxed text-amber-950 dark:border-amber-200/30 dark:bg-amber-200/10 dark:text-amber-100" role="status">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        {checking ? "Checking payment availability…"
          : ready
            ? "Verified Stripe crypto checkout converts eligible wallet payments into US dollars. Campaign credit follows payment confirmation."
            : "Cryptocurrency donations are not live yet. Connecting a wallet does not send or receive money."}
      </p>
      {ready && !platformSupport && campaign?.id && (
        <Button type="button" className="w-full mt-3 rounded-xl" disabled={paying || connecting} onClick={checkout}>
          {paying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
          Pay {Number(amount) > 0 ? `$${Number(amount).toFixed(2)}` : ""} with crypto
        </Button>
      )}
      {reownConfigured()
        ? <Button type="button" variant="outline" className="w-full mt-2 border-violet-400 bg-white text-violet-950 hover:bg-violet-100 dark:border-violet-300 dark:bg-slate-800 dark:text-violet-100 dark:hover:bg-slate-700 dark:hover:text-white" onClick={connect} disabled={connecting || paying}>
            {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
            Connect wallet (no payment)
          </Button>
        : <p className="mt-2 text-sm leading-relaxed text-violet-900 dark:text-violet-100">Standalone wallet connection is awaiting provider setup. Stripe can connect wallets during approved checkout.</p>}
      {error && <p role="alert" className="mt-2 text-sm font-medium text-red-800 dark:text-red-200">{error}</p>}
    </section>
  );
}
