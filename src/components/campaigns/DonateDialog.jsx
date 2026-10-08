import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useUrlDialog from "@/hooks/useUrlDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import CashAppDonateButton from "@/components/payments/CashAppDonateButton";
import GooglePayButton from "@/components/payments/GooglePayButton";
import PayPalDonateButton from "@/components/payments/PayPalDonateButton";
import CryptoDonateOption from "@/components/payments/CryptoDonateOption";
import PayPalCheckoutButton from "@/components/payments/PayPalCheckoutButton";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";
import { Heart, Loader2, Lock, CheckCircle2, Sparkles, CreditCard } from "lucide-react";
import { computeBreakdown, computePayPalBreakdown, computePayPalWalletBreakdown, MIN_DONATION } from "@/lib/fees";

const presets = [25, 50, 100, 250];

function RailBreakdown({ rail, breakdown }) {
  return <div className="mt-3 rounded-lg bg-stone-50 p-3"><p className="text-[11px] font-semibold text-stone-700">{rail} breakdown</p><dl className="mt-1.5 space-y-1 text-[11px] text-stone-600"><div className="flex justify-between gap-3"><dt>Total charged</dt><dd>${breakdown.totalCharged.toFixed(2)}</dd></div><div className="flex justify-between gap-3"><dt>{rail} processing</dt><dd>-${breakdown.processing.toFixed(2)}</dd></div><div className="flex justify-between gap-3"><dt>Donation after processing</dt><dd>${breakdown.amount.toFixed(2)}</dd></div>{breakdown.contribution > 0 && <div className="flex justify-between gap-3"><dt>Optional platform support</dt><dd>-${breakdown.contribution.toFixed(2)}</dd></div>}<div className="flex justify-between gap-3"><dt>IF fee at withdrawal (3%)</dt><dd>-${breakdown.platformFee.toFixed(2)}</dd></div><div className="flex justify-between gap-3 border-t border-stone-200 pt-1 font-semibold text-emerald-700"><dt>Expected to campaign</dt><dd>${breakdown.recipientNet.toFixed(2)}</dd></div></dl></div>;
}

export default function DonateDialog({ campaign, onDonated, open: controlledOpen, onOpenChange: controlledOnOpenChange, hideTrigger }) {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const newCheckoutEnabled = useFeatureEnabled("payment_checkout_enabled");
  const paypalEnabled = useFeatureEnabled("paypal_checkout");
  const stripeEnabled = useFeatureEnabled("stripe_checkout");
  const googlePayEnabled = useFeatureEnabled("google_pay_checkout");
  const recurringEnabled = useFeatureEnabled("recurring_donations");
  const [urlOpen, setUrlOpen] = useUrlDialog("donate");
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : urlOpen;
  const setOpen = (v) => { if (isControlled) controlledOnOpenChange?.(v); else setUrlOpen(v); };
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [platformContribution, setPlatformContribution] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [capabilityError, setCapabilityError] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const idempotencyRef = useRef(crypto.randomUUID());
  const newIntent = () => { idempotencyRef.current = crypto.randomUUID(); };
  const bd = computeBreakdown(parseFloat(amount) || 0, platformContribution);
  const paypalBd = computePayPalBreakdown(parseFloat(amount) || 0, platformContribution);
  const paypalWalletBd = computePayPalWalletBreakdown(parseFloat(amount) || 0, platformContribution);

  useEffect(() => {
    let cancelled = false;
    // Public prelaunch donations use only the separately labeled platform link;
    // do not probe PayPal REST credentials for every preview visitor.
    if (!open || platformOnlyMode) return undefined;
    setCapabilityError(false);
    base44.functions.invoke("getPaymentCapabilities", {})
      .then(({ data }) => { if (!cancelled) setCapabilities(data || {}); })
      .catch(() => { if (!cancelled) { setCapabilities(null); setCapabilityError(true); } });
    return () => { cancelled = true; };
  }, [open, platformOnlyMode]);

  const platformOnlyPrelaunch = platformOnlyMode;
  const paypalApiAvailable = newCheckoutEnabled && paypalEnabled && capabilities?.paypal?.api_live === true;
  const googlePayAvailable = newCheckoutEnabled && googlePayEnabled && capabilities?.paypal?.api_live === true;
  const stripeAvailable = !platformOnlyMode && newCheckoutEnabled && stripeEnabled && capabilities?.stripe?.live === true;
  useEffect(() => {
    if (recurring && capabilities && (!stripeAvailable || !recurringEnabled)) setRecurring(false);
  }, [recurring, capabilities, stripeAvailable, recurringEnabled]);

  const confirmManualDonation = async (payment_method) => {
    const value = parseFloat(amount);
    if (!value || value < MIN_DONATION) { setError(`Enter an amount of at least $${MIN_DONATION}.`); return; }
    setSaving(true); setError("");
    try {
      const { data } = await base44.functions.invoke("recordDonation", {
        campaign_id: campaign.id, amount: value, donor_name: name, message,
        is_recurring: false, payment_method, platform_contribution: platformContribution,
        idempotency_key: idempotencyRef.current,
      });
      if (data?.pending_verification) {
        setError("Payment reported as pending. It will not affect the campaign total until an administrator separately verifies that it arrived.");
      } else {
        setError("We couldn't record your payment safely. Please try again.");
      }
    } catch (_) { setError("We couldn't record your payment. Please try again."); }
    setSaving(false);
  };

  const startStripeCheckout = async () => {
    if (!stripeAvailable) { setError("Card payments are not currently available."); return; }
    const value = parseFloat(amount);
    if (!value || value < MIN_DONATION) { setError(`Enter an amount of at least $${MIN_DONATION}.`); return; }
    setStripeLoading(true); setError("");
    try {
      const { data } = await base44.functions.invoke("createDonationCheckout", {
        campaign_id: campaign.id, amount: value, donor_name: name, message,
        is_recurring: recurring, origin: window.location.origin,
        platform_contribution: platformContribution,
      });
      if (data?.url) { window.location.href = data.url; return; }
      setError("Couldn't start card checkout safely. Please try again.");
    } catch (_) { setError("Couldn't start card checkout. Please try again."); }
    setStripeLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConfirmed(false); newIntent(); } }}>
      {!hideTrigger && <div className="space-y-2"><DialogTrigger asChild><Button size="lg" className="w-full rounded-xl h-12 text-base bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20 hover:opacity-90"><Heart className="w-4 h-4 mr-2" /> {platformOnlyPrelaunch ? "Support Interplanetary Fund" : "Donate"}</Button></DialogTrigger>{platformOnlyPrelaunch && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center"><p className="text-xs font-semibold text-amber-900">Donate to the platform, not this campaign</p><p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">This payment supports Interplanetary Fund itself and is not credited to the campaign shown.</p></div>}</div>}
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-xl">{platformOnlyPrelaunch ? "Support Interplanetary Fund" : "Support this campaign"}</DialogTitle></DialogHeader>
        {platformOnlyPrelaunch ? (
          <div className="space-y-4">
            <PrelaunchNotice payment />
            <p className="text-sm text-stone-600">This campaign is live and shareable, but it cannot accept donations while campaign fundraising is paused. Use the separate button below to support the platform instead.</p>
            <PayPalDonateButton label="Donate to Interplanetary Fund" />
            <CryptoDonateOption platformSupport />
          </div>
        ) : confirmed ? (
          <div className="text-center py-6"><CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" /><p className="font-display text-lg text-stone-900 mb-1">Thank you.</p><p className="text-sm text-stone-500">Your gift has been added to this campaign.</p></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">{presets.map((p) => <button key={p} onClick={() => setAmount(String(p))} className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${amount === String(p) ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}>${p}</button>)}</div>
            <Input type="number" min={MIN_DONATION} step="1" placeholder="Custom amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="Leave a message of support (optional)" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />

            {stripeAvailable && recurringEnabled && <div className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3"><Label htmlFor="recurring" className="text-sm text-stone-700">Give monthly</Label><Switch id="recurring" checked={recurring} onCheckedChange={setRecurring} /></div>}

            <div className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3"><div><Label htmlFor="contrib" className="text-sm text-stone-700 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Support the platform</Label><p className="text-xs text-stone-500 mt-0.5">Direct 10% of your gift to Interplanetary Fund. Optional, off by default.</p></div><Switch id="contrib" checked={platformContribution} onCheckedChange={setPlatformContribution} /></div>

            {stripeAvailable && amount && parseFloat(amount) > 0 && <div className="rounded-xl border border-stone-200 p-4 bg-stone-50/50"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Card payment breakdown</p><dl className="text-sm space-y-1.5"><div className="flex justify-between"><dt className="text-stone-600">Donation</dt><dd className="text-stone-900 font-medium">${bd.amount.toFixed(2)}</dd></div><div className="flex justify-between"><dt className="text-stone-500">Stripe processing (included in total)</dt><dd className="text-stone-900">-${bd.processing.toFixed(2)}</dd></div>{bd.contribution > 0 && <div className="flex justify-between"><dt className="text-stone-600">Optional Interplanetary Fund contribution (10%)</dt><dd className="text-amber-600">-${bd.contribution.toFixed(2)}</dd></div>}<div className="flex justify-between"><dt className="text-stone-500">Interplanetary Fund fee (3%, at payout)</dt><dd className="text-stone-400">-${bd.platformFee.toFixed(2)}</dd></div><div className="flex justify-between border-t border-stone-200 pt-1.5"><dt className="text-stone-700 font-medium">Expected amount to campaign</dt><dd className="text-emerald-600 font-semibold">${bd.recipientNet.toFixed(2)}</dd></div></dl></div>}

            {!capabilities && !capabilityError && <div className="flex items-center justify-center py-4 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking available payment methods…</div>}
            {capabilityError && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">We couldn’t check payment choices right now. Please try again.</p>}
            {capabilities && !paypalApiAvailable && !stripeAvailable && (platformOnlyMode || !campaign.cashapp_tag) && <p className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">Campaign donations are not available through a verified payment method right now. No payment has been started.</p>}


            {!recurring && paypalApiAvailable && <div className="rounded-xl border border-stone-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with PayPal</p><PayPalCheckoutButton campaign={campaign} amount={amount} donorName={name} message={message} platformContribution={platformContribution} onPaid={() => { setConfirmed(true); if (onDonated) onDonated(); }} />{amount && parseFloat(amount) > 0 && <RailBreakdown rail="PayPal" breakdown={paypalBd} />}</div>}

            {!recurring && googlePayAvailable && <div className={googlePayReady ? "rounded-xl border border-stone-200 p-4" : "hidden"}><p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with Google Pay</p><GooglePayButton campaign={campaign} amount={amount} donorName={name} message={message} recurring={false} platformContribution={platformContribution} onReadyChange={setGooglePayReady} onPaid={() => { setConfirmed(true); if (onDonated) onDonated(); }} />{amount && parseFloat(amount) > 0 ? <RailBreakdown rail="Google Pay via PayPal" breakdown={paypalWalletBd} /> : <p className="text-[11px] text-stone-400 mt-2 text-center">Processed by the configured PayPal payment service.</p>}</div>}

            {stripeAvailable && <div className="rounded-xl border border-stone-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">{recurring ? "Monthly giving via card" : "Give with a card"}</p><Button onClick={startStripeCheckout} disabled={stripeLoading || !amount} className="w-full h-10 rounded-xl bg-[#635BFF] hover:bg-[#635BFF]/90 text-white border-0">{stripeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1.5" />} {amount ? `Donate $${bd.totalCharged.toFixed(2)} with card` : "Donate with card"}</Button><p className="text-[11px] text-stone-400 mt-2 text-center">Secure card payment via Stripe.</p></div>}

            {!platformOnlyMode && !recurring && campaign.cashapp_tag && <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-1">Give with Cash App — owner-provided</p><p className="text-xs text-amber-800 mb-3">Manual, unverified payment method. Interplanetary Fund has not verified this Cash App tag or payment destination.</p><CashAppDonateButton cashtag={campaign.cashapp_tag} amount={amount} /><Button onClick={() => confirmManualDonation("cashapp")} disabled={saving || !amount} variant="outline" className="w-full mt-3 h-10 rounded-xl">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "I sent this Cash App payment"}</Button><p className="text-[11px] text-amber-800 mt-2 text-center">Your report remains pending and does not increase the campaign total until the payment is separately verified.</p></div>}

            {!recurring && <CryptoDonateOption campaign={campaign} amount={amount}
              donorName={name} message={message} platformContribution={platformContribution} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="flex items-center justify-center gap-1.5 text-xs text-stone-400"><Lock className="w-3 h-3" /> Only payment choices that are ready will appear here.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
