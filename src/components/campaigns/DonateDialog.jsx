import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Heart, Loader2, Lock } from "lucide-react";

const presets = [25, 50, 100, 250];

export default function DonateDialog({ campaign }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    if (window.self !== window.top) {
      setError("Checkout only works from the published app. Open your app in a new tab to donate.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("createDonationCheckout", {
        campaign_id: campaign.id,
        amount: value,
        donor_name: name,
        message,
        is_recurring: recurring,
        origin: window.location.origin,
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError("Could not start checkout. Please try again.");
    } catch (e) {
      setError("Could not start checkout. Please try again.");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-xl h-12 text-base">
          <Heart className="w-4 h-4 mr-2" /> Donate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Support this campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button key={p} onClick={() => setAmount(String(p))}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  amount === String(p) ? "border-orange-600 bg-orange-50 text-orange-700" : "border-stone-200 text-stone-700 hover:border-stone-300"
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={submit} disabled={saving || !amount} className="w-full bg-orange-600 hover:bg-orange-500 text-white h-11 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Donate ${amount ? `$${amount}` : ""}${recurring ? " / month" : ""}`}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-stone-400">
            <Lock className="w-3 h-3" /> Secure payment powered by Stripe
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}