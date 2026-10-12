import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Gift, Loader2, Copy, Share2, CheckCircle2 } from "lucide-react";
import { canIssueReferralCard } from "../../../base44/shared/referralPolicy.js";

// Recipient-specific link and real QR. This component does not claim a Wallet
// pass was provisioned; native tap-to-Wallet transfer requires separate issuer
// approval and real-device verification.
export default function ReferralCardShare({ user }) {
  const eligible = canIssueReferralCard(user);
  const [card, setCard] = useState(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!eligible) return null;

  const create = async () => {
    setBusy(true);
    setMessage("");
    setCard(null);
    setQr("");
    try {
      const { data } = await base44.functions.invoke("issueReferralCard", {});
      if (!data?.ok || !data?.url || !data?.code) throw new Error("Card issuance failed.");
      setCard(data);
      const qrResponse = await base44.functions.invoke("renderReferralCardQr", { code: data.code });
      if (qrResponse?.data?.qr_data_url && qrResponse?.data?.url === data.url) {
        setQr(qrResponse.data.qr_data_url);
      } else {
        setMessage("Your link is ready. QR generation is unavailable right now.");
      }
    } catch {
      setMessage("Could not create a referral card. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!card?.url) return;
    try {
      await navigator.clipboard.writeText(card.url);
      setMessage("Referral link copied.");
    } catch {
      setMessage("Select and copy the link below to share it.");
    }
  };

  const share = async () => {
    if (!card?.url) return;
    if (typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({
        title: "Interplanetary Fund: What if?",
        text: "Explore Interplanetary Fund and claim your one-time 30-day full-access invitation.",
        url: card.url,
      });
      setMessage("");
    } catch (error) {
      if (error?.name !== "AbortError") setMessage("Sharing was interrupted. You can copy the link instead.");
    }
  };

  return (
    <section aria-label="Share Interplanetary Fund referral cards"
      className="mb-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-2 text-foreground">
        <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl">Invite someone to IFund</h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        Create a separate business card link for each new friend. Each code can be redeemed once
        for 30 days of full paid-tier access, with no automatic charge.
        Unused codes do not expire. You can share cards while your paid subscription is active.
      </p>
      <Button type="button" className="rounded-xl" disabled={busy} onClick={create}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
        {busy ? "Creating…" : "Create a new referral card"}
      </Button>
      {card && (
        <div className="mt-5 rounded-xl border border-border bg-background p-4" role="region" aria-label="Your new referral card">
          <p className="font-semibold text-foreground">Interplanetary Fund — What if?</p>
          <p className="text-xs text-muted-foreground mt-1">A unique invitation, ready to share</p>
          {qr && <img className="mt-4 mx-auto h-52 w-52 rounded-lg border border-border bg-white p-2" src={qr} alt="Scannable QR code to this IFund referral invitation" />}
          <p className="mt-4 font-mono text-sm break-all text-foreground">{card.code}</p>
          <a href={card.url} className="mt-2 block break-all text-sm text-primary underline" target="_blank" rel="noopener noreferrer">{card.url}</a>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-2" /> Copy link</Button>
            <Button onClick={share}><Share2 className="h-4 w-4 mr-2" /> Share</Button>
          </div>
        </div>
      )}
      {message && <p role="status" className="text-sm text-foreground mt-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />{message}</p>}
    </section>
  );
}
