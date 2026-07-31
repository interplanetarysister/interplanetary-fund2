import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Wallet, ShieldCheck, Clock, AlertTriangle, CheckCircle2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { useToast } from "@/components/ui/use-toast";
import WithdrawalDialog from "@/components/withdrawals/WithdrawalDialog";

const CLEARING_DAYS = 7;
const FEE_RATE = 0.08;
const money = (n) => (n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const STATUS_STYLE = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  under_review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  processing: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  pending: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export default function Withdrawals() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [history, setHistory] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  const load = async () => {
    const me = await base44.auth.me();
    setUser(me);
    const all = await base44.entities.Campaign.filter({});
    const owned = (all || []).filter((c) => c.created_by_id === me.id);
    const cutoff = Date.now() - CLEARING_DAYS * 86400000;
    const enriched = [];
    for (const c of owned) {
      const donations = await base44.entities.Donation.filter({ campaign_id: c.id });
      const avail = donations.filter((d) => !d.withdrawal_id && new Date(d.created_date).getTime() <= cutoff).reduce((s, d) => s + (d.amount || 0), 0);
      const clearing = donations.filter((d) => !d.withdrawal_id && new Date(d.created_date).getTime() > cutoff).reduce((s, d) => s + (d.amount || 0), 0);
      const withdrawn = donations.filter((d) => d.withdrawal_id).reduce((s, d) => s + (d.amount || 0), 0);
      enriched.push({ ...c, available: Math.round(avail * 100) / 100, inClearing: Math.round(clearing * 100) / 100, withdrawn: Math.round(withdrawn * 100) / 100 });
    }
    setCampaigns(enriched);

    const w = await base44.entities.Withdrawal.filter({ owner_user_id: me.id });
    setHistory((w || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));

    if (me.role === "admin") {
      const rq = await base44.entities.Withdrawal.filter({ status: "under_review" });
      setReviewQueue(rq || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      const res = await base44.functions.invoke("requestWithdrawal", { action: "approve", withdrawal_id: id });
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Withdrawal approved & paid out" });
      load();
    } catch (e) {
      toast({ title: "Approval failed", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  }

  const totalAvailable = campaigns.reduce((s, c) => s + c.available, 0);
  const totalClearing = campaigns.reduce((s, c) => s + c.inClearing, 0);

  return (
    <div className="deep-space min-h-screen text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-slate-100">Withdrawals</h1>
              <p className="text-sm text-slate-400">Cash out cleared funds from your campaigns to your PayPal account.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Available now</p>
              <p className="font-display text-2xl text-emerald-300">{money(totalAvailable)}</p>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">In clearing (7-day hold)</p>
              <p className="font-display text-2xl text-amber-300">{money(totalClearing)}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-300 glass-panel rounded-xl p-3">
            <ShieldCheck className="w-4 h-4 mt-0.5 text-cyan-300 shrink-0" />
            <p>Fraud protection: a 7-day clearing hold on every donation, one withdrawal per day, payouts only to your verified PayPal email, and an 8% platform fee deducted at payout. Withdrawals over $1,000 get a quick manual review.</p>
          </div>
        </header>

        {/* Campaign balances */}
        <section className="space-y-3">
          <h2 className="font-display text-lg text-slate-200">Your campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-slate-400">
              You don't have any campaigns yet. Once supporters start giving, cleared funds will show up here.
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <Image src={c.cover_image_url || FALLBACK_IMAGE} alt={c.title} className="w-full sm:w-24 h-24 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-100 truncate">{c.title}</h3>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-400">Available</p>
                        <p className="text-emerald-300 font-semibold">{money(c.available)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">In clearing</p>
                        <p className="text-amber-300 font-semibold">{money(c.inClearing)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Withdrawn</p>
                        <p className="text-slate-300 font-semibold">{money(c.withdrawn)}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    disabled={c.available <= 0}
                    onClick={() => setActive(c)}
                    className="rounded-xl sm:self-center bg-cyan-500 hover:bg-cyan-400 text-slate-900"
                  >
                    {c.available > 0 ? `Withdraw ${money(c.available)}` : "Nothing to withdraw"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Admin review queue */}
        {user?.role === "admin" && reviewQueue.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-300" />
              <h2 className="font-display text-lg text-slate-200">Review queue</h2>
            </div>
            <div className="space-y-2">
              {reviewQueue.map((w) => (
                <div key={w.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">{money(w.net_amount)} → {w.paypal_email}</p>
                    <p className="text-xs text-slate-400">{w.campaign_title} · {fmtDate(w.created_date)}</p>
                    {w.review_note && <p className="text-xs text-amber-300/80 mt-1">{w.review_note}</p>}
                  </div>
                  <Button size="sm" onClick={() => approve(w.id)} className="rounded-xl">Approve & pay</Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* History */}
        <section className="space-y-3">
          <h2 className="font-display text-lg text-slate-200">Withdrawal history</h2>
          {history.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-slate-400">No withdrawals yet.</div>
          ) : (
            <div className="space-y-2">
              {history.map((w) => (
                <div key={w.id} className="glass-panel rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 truncate">{w.campaign_title}</p>
                    <p className="text-xs text-slate-400">{fmtDate(w.created_date)} · {w.paypal_email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-emerald-300 font-medium">{money(w.net_amount)}</p>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[w.status]}`}>{w.status.replace("_", " ")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {active && (
        <WithdrawalDialog
          campaign={active}
          open={!!active}
          onOpenChange={(o) => !o && setActive(null)}
          onDone={load}
        />
      )}
    </div>
  );
}