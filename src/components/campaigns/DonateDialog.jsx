import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import useUrlDialog from "@/hooks/useUrlDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import PayPalDonateButton from "@/components/payments/PayPalDonateButton";
import CashAppDonateButton from "@/components/payments/CashAppDonateButton";
import GooglePayButton from "@/components/payments/GooglePayButton";
import { Heart, Loader2, Lock, CheckCircle2, Sparkles, CreditCard } from "lucide-react";
import { computeBreakdown, MIN_DONATION } from "../../../base44/shared/fees.js";

const presets = [25, 50, 100, 250];

export default function DonateDialog({ campaign, onDonated, open: controlledOpen, onOpenChange: controlledOnOpenChange, hideTrigger }) {
  // URL-driven so the Android back button closes the sheet instead of leaving
  // the campaign page. Still supports a parent-controlled open state.
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
  // One idempotency key per donation intent — if the supporter double-clicks
  // or the request is retried, the backend returns the original record
  // instead of creating a duplicate ledger entry.
  const idempotencyRef = useRef(crypto.randomUUID());
  const newIntent = () => { idempotencyRef.current = crypto.randomUUID(); };
  const bd = computeBreakdown(parseFloat(amount) || 0, platformContribution);

  // PayPal and Cash App complete on their own secure sites, so the supporter
  // confirms the gift here and it is added to the campaign ledger.
  const confirmDonation = async (payment_method) => {
    const value = parseFloat(amount);
    if (!value || value < MIN_DONATION) { setError(`Enter an amount of at least $${MIN_DONATION}.`); return; }
    setSaving(true);
    setError("");
    try {
      await base44.functions.invoke("recordDonation", {
        campaign_id: campaign.id,
        amount: value,
        donor_name: name,
        message,
        is_recurring: false, // PayPal / Cash App are one-time only; monthly giving uses the card (Stripe) path.
        payment_method,
        platform_contribution: platformContribution,
        idempotency_key: idempotencyRef.current,
      });
      setConfirmed(true);
      if (onDonated) onDonated();
    } catch (e) {
      setError("We couldn't record your gift. Please try again.");
    }
    setSaving(false);
  };

  // Stripe Checkout — the donor is redirected to Stripe's hosted page, then
  // returns to the campaign. The Stripe webhook records the gift from Stripe's
  // authoritative amount_total, so no client-side fee math reaches the ledger.
  const startStripeCheckout = async () => {
    const value = parseFloat(amount);
    if (!value || value < MIN_DONATION) { setError(`Enter an amount of at least $${MIN_DONATION}.`); return; }
    setStripeLoading(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("createDonationCheckout", {
        campaign_id: campaign.id,
        amount: value,
        donor_name: name,
        message,
        is_recurring: recurring,
        origin: window.location.origin,
        platform_contribution: platformContribution,
      });
      if (data?.url) { window.location.href = data.url; return; }
      setError(data?.error || "Couldn't start card checkout.");
    } catch (e) {
      setError("Couldn't start card checkout. Please try again.");
    }
    setStripeLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConfirmed(false); newIntent(); } }}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="lg" className="w-full rounded-xl h-12 text-base bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20 hover:opacity-90">
            <Heart className="w-4 h-4 mr-2" /> Donate
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Support this campaign</DialogTitle>
        </DialogHeader>

        {confirmed ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-display text-lg text-stone-900 mb-1">Thank you.</p>
            <p className="text-sm text-stone-500">Your gift has been added to this campaign.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {presets.map((p) => (
                <button key={p} onClick={() => setAmount(String(p))}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    amount === String(p) ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}>
                  ${p}
                </button>
              ))}
            </div>
            <Input type="number" min={MIN_DONATION} step="1" placeholder="Custom amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="Leave a message of support (optional)" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
            <div className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3">
              <Label htmlFor="recurring" className="text-sm text-stone-700">Give monthly</Label>
              <Switch id="recurring" checked={recurring} onCheckedChange={setRecurring} />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3">
              <div>
                <Label htmlFor="contrib" className="text-sm text-stone-700 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Support the platform</Label>
                <p className="text-xs text-stone-500 mt-0.5">Direct 10% of your gift to Interplanetary Fund. Optional, off by default.</p>
              </div>
              <Switch id="contrib" checked={platformContribution} onCheckedChange={setPlatformContribution} />
            </div>

            {amount && parseFloat(amount) > 0 && (
              <div className="rounded-xl border border-stone-200 p-4 bg-stone-50/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Where your gift goes</p>
                <dl className="text-sm space-y-1.5">
                  <div className="flex justify-between"><dt className="text-stone-600">You give</dt><dd className="text-stone-900 font-medium">${bd.amount.toFixed(2)}</dd></div>
                  {bd.contribution > 0 && <div className="flex justify-between"><dt className="text-stone-600">Platform contribution (10%)</dt><dd className="text-amber-600">-${bd.contribution.toFixed(2)}</dd></div>}
                  <div className="flex justify-between"><dt className="text-stone-500">Processing fee (covered by us)</dt><dd className="text-stone-400">${bd.processing.toFixed(2)}</dd></div>
                  <div className="flex justify-between"><dt className="text-stone-500">Platform fee (3%, at payout)</dt><dd className="text-stone-400">-${bd.platformFee.toFixed(2)}</dd></div>
                  <div className="flex justify-between border-t border-stone-200 pt-1.5"><dt className="text-stone-700 font-medium">Campaign receives</dt><dd className="text-emerald-600 font-semibold">${bd.recipientNet.toFixed(2)}</dd></div>
                </dl>
              </div>
            )}

            {!recurring && (
            <div className="rounded-xl border border-stone-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with PayPal</p>
              <PayPalDonateButton campaignTitle={campaign?.title} amount={amount} />
              <Button onClick={() => confirmDonation("paypal")} disabled={saving || !amount} variant="outline" className="w-full mt-3 h-10 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "I completed my PayPal donation"}
              </Button>
            </div>
            )}

            {!recurring && (
            <div className="rounded-xl border border-stone-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with Google Pay</p>
              <GooglePayButton
                campaign={campaign}
                amount={amount}
                donorName={name}
                message={message}
                recurring={false}
                platformContribution={platformContribution}
                onPaid={() => { setConfirmed(true); if (onDonated) onDonated(); }}
              />
              <p className="text-[11px] text-stone-400 mt-2 text-center">Processed by your PayPal business account — fast &amp; secure.</p>
            </div>
            )}

            <div className="rounded-xl border border-stone-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">{recurring ? "Monthly giving via card" : "Give with a card"}</p>
              <Button onClick={startStripeCheckout} disabled={stripeLoading || !amount} className="w-full h-10 rounded-xl bg-[#635BFF] hover:bg-[#635BFF]/90 text-white border-0">
                {stripeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1.5" />} {amount ? `Donate $${amount} with card` : "Donate with card"}
              </Button>
              <p className="text-[11px] text-stone-400 mt-2 text-center">Secure card payment via Stripe.</p>
            </div>

            {!recurring && campaign.cashapp_tag && (
              <div className="rounded-xl border border-stone-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with Cash App</p>
                <CashAppDonateButton cashtag={campaign.cashapp_tag} amount={amount} />
                <Button onClick={() => confirmDonation("cashapp")} disabled={saving || !amount} variant="outline" className="w-full mt-3 h-10 rounded-xl">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "I completed my Cash App payment"}
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="flex items-center justify-center gap-1.5 text-xs text-stone-400">
              <Lock className="w-3 h-3" /> Payments are handled securely by Stripe, PayPal, and Cash App
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}