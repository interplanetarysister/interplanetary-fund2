import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import PayPalDonateButton from "@/components/payments/PayPalDonateButton";
import CashAppDonateButton from "@/components/payments/CashAppDonateButton";
import GooglePayButton from "@/components/payments/GooglePayButton";
import { Heart, Loader2, Lock, CheckCircle2 } from "lucide-react";

const presets = [25, 50, 100, 250];

export default function DonateDialog({ campaign, onDonated }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // PayPal and Cash App complete on their own secure sites, so the supporter
  // confirms the gift here and it is added to the campaign ledger.
  const confirmDonation = async (payment_method) => {
    const value = parseFloat(amount);
    if (!value || value <= 0) { setError("Enter the amount you gave so we can add it to the campaign."); return; }
    setSaving(true);
    setError("");
    try {
      await base44.functions.invoke("recordDonation", {
        campaign_id: campaign.id,
        amount: value,
        donor_name: name,
        message,
        is_recurring: recurring,
        payment_method,
      });
      setConfirmed(true);
      if (onDonated) onDonated();
    } catch (e) {
      setError("We couldn't record your gift. Please try again.");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmed(false); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full rounded-xl h-12 text-base bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20 hover:opacity-90">
          <Heart className="w-4 h-4 mr-2" /> Donate
        </Button>
      </DialogTrigger>
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
            <Input type="number" min="1" placeholder="Custom amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="Leave a message of support (optional)" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
            <div className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3">
              <Label htmlFor="recurring" className="text-sm text-stone-700">Give monthly</Label>
              <Switch id="recurring" checked={recurring} onCheckedChange={setRecurring} />
            </div>

            <div className="rounded-xl border border-stone-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with PayPal or a card</p>
              <PayPalDonateButton label={amount ? `Donate $${amount}` : "Donate now!"} />
              <Button onClick={() => confirmDonation("paypal")} disabled={saving || !amount} variant="outline" className="w-full mt-3 h-10 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "I completed my PayPal donation"}
              </Button>
            </div>

            <div className="rounded-xl border border-stone-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Give with Google Pay</p>
              <GooglePayButton
                campaign={campaign}
                amount={amount}
                donorName={name}
                message={message}
                recurring={recurring}
                onPaid={() => { setConfirmed(true); if (onDonated) onDonated(); }}
              />
              <p className="text-[11px] text-stone-400 mt-2 text-center">Processed by your PayPal business account — fast &amp; secure.</p>
            </div>

            {campaign.cashapp_tag && (
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
              <Lock className="w-3 h-3" /> Payments are handled securely by PayPal and Cash App
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}