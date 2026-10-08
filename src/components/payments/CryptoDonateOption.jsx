import React, { useEffect, useState } from "react";
import { Wallet, Loader2, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { reownConfigured, openReownWallet } from "@/lib/reownWallet";

// Shared UI for campaign donations and contributions to IFund itself.
// Wallet connections never trigger transfers or update financial totals.
export default function CryptoDonateOption({ campaign = null, platformSupport = false }) {
  const [readiness, setReadiness] = useState(null);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
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

  return (
    <section className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-stone-900" aria-label="Cryptocurrency donations">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-900"><Wallet className="w-4 h-4" /> Donate cryptocurrency</h3>
      <p className="text-xs text-violet-950 mt-1">
        {platformSupport ? "Support Interplanetary Fund using a crypto wallet." : "The campaign creator has opted into cryptocurrency giving."}
        {" "}Reown AppKit can connect compatible wallets across Ethereum-compatible chains, Solana and Bitcoin.
      </p>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        {checking ? "Checking payment availability..." : readiness?.verified_checkout_live === true
          ? "Wallet connection is available; only complete payments through a verified checkout."
          : "Crypto payments are being prepared. No transfers can be accepted here yet; do not send coins to an address provided outside verified checkout."}
      </p>
      {reownConfigured()
        ? <Button type="button" variant="outline" className="w-full mt-3 border-violet-300 text-violet-900" onClick={connect} disabled={connecting || checking}>
            {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
            Connect wallet (no payment yet)
          </Button>
        : <p className="text-xs text-violet-800 mt-2">Wallet connection is awaiting platform provider setup.</p>}
      {error && <p role="alert" className="text-xs text-red-700 mt-2">{error}</p>}
    </section>
  );
}
