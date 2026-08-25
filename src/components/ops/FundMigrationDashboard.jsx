import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRightLeft, Plus, X, CheckCircle2, AlertCircle } from "lucide-react";

const PLATFORM_FEE_RATE = 0.08;
const SOURCE_PLATFORMS = ["GoFundMe", "Kickstarter", "Indiegogo", "Facebook", "GiveSendGo", "CashApp", "PayPal", "Other"];
const PAYOUT_METHOD = "paypal";

const fmt = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const makeRequestId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return `migration_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
};
const emptyEntry = () => ({ campaignId: "", campaignTitle: "", sourcePlatform: "GoFundMe", grossAmount: "" });

// Fund Migration Dashboard — the UI collects operational input only.
// Financial validation and Withdrawal creation are performed by the
// admin-only createFundMigration backend function.
export default function FundMigrationDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [pending, setPending] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [step, setStep] = useState("entries");
  const [migrations, setMigrations] = useState([emptyEntry()]);
  const [payoutDest, setPayoutDest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (me?.role !== "admin") {
          setError("Admin access required.");
          return;
        }
        const [c, w] = await Promise.all([
          base44.entities.Campaign.list("-raised_amount", 100),
          base44.entities.Withdrawal.filter({ status: "pending" }),
        ]);
        setCampaigns(c || []);
        setPending(w || []);
      } catch (e) {
        console.error("Fund Migration load error:", e);
        setError("Unable to load migration data. Please try again.");
      } finally {
        setLoadingCampaigns(false);
      }
    })();
  }, []);

  const updateRow = (index, field, value) => {
    setMigrations((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "campaignId") {
        const campaign = campaigns.find((item) => item.id === value);
        next[index].campaignTitle = campaign?.title || "";
      }
      return next;
    });
  };

  const billable = useMemo(() => migrations.filter((m) => Number(m.grossAmount) > 0), [migrations]);
  const totalGross = useMemo(() => billable.reduce((sum, m) => sum + Number(m.grossAmount || 0), 0), [billable]);
  const estimatedPlatformFee = totalGross * PLATFORM_FEE_RATE;
  const estimatedNet = totalGross - estimatedPlatformFee;

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (!billable.length) throw new Error("Fill in at least one migration entry.");
      if (!payoutDest.trim()) throw new Error("Enter the authorized PayPal payout destination.");

      const created = [];
      for (const migration of billable) {
        if (!migration.campaignId || !migration.sourcePlatform) {
          throw new Error("Each migration needs a campaign and source platform.");
        }
        const response = await base44.functions.invoke("createFundMigration", {
          request_id: makeRequestId(),
          campaign_id: migration.campaignId,
          source_platform: migration.sourcePlatform,
          gross_amount: Number(migration.grossAmount),
          payout_method: PAYOUT_METHOD,
          payout_destination: payoutDest.trim(),
        });
        const data = response?.data || {};
        if (!data.ok) throw new Error(data.error || "Migration could not be recorded.");
        created.push(data);
      }

      setResult({ created, totalGross });
      setStep("result");
    } catch (e) {
      console.error("Fund Migration submit error:", e);
      setError(e?.response?.data?.error || e?.message || "Migration could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "result") {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <p className="font-display text-lg text-slate-100 mb-1">Migration request recorded</p>
        <p className="text-sm text-slate-400">{result.created.length} withdrawal request{result.created.length !== 1 ? "s" : ""} queued for the authoritative payout review workflow · {fmt(result.totalGross)} gross</p>
        <p className="text-xs text-slate-500 mt-2">The server calculated the authoritative fee and net amount. No client-calculated financial value was persisted.</p>
        <Button variant="ghost" className="mt-5 text-cyan-400 hover:text-cyan-300" onClick={() => { setStep("entries"); setMigrations([emptyEntry()]); setResult(null); setPayoutDest(""); }}>
          New migration
        </Button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Confirm Migration Request</h3>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
          {billable.map((m, i) => <div key={i} className="flex justify-between text-slate-300"><span>{m.campaignTitle || m.campaignId} · {m.sourcePlatform}</span><span className="font-semibold">{fmt(m.grossAmount)}</span></div>)}
          <div className="pt-2 border-t border-white/10 space-y-1">
            <div className="flex justify-between text-xs text-slate-400"><span>Estimated platform fee</span><span>− {fmt(estimatedPlatformFee)}</span></div>
            <div className="flex justify-between font-bold text-slate-100"><span>Estimated net</span><span>{fmt(estimatedNet)}</span></div>
            <p className="text-[11px] text-slate-500">These are display estimates only. The authoritative server workflow recalculates the financial values.</p>
          </div>
          <div className="pt-2 border-t border-white/10 text-xs text-slate-400">Payout method <span className="text-cyan-300">PayPal</span> · destination <span className="text-cyan-300">{payoutDest}</span></div>
        </div>
        {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 text-slate-400" onClick={() => setStep("payout")} disabled={submitting}>Back</Button>
          <Button className="flex-1 bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30" onClick={handleSubmit} disabled={submitting}>{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit migration"}</Button>
        </div>
      </div>
    );
  }

  if (step === "payout") {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Authorized Payout Destination</h3>
        <p className="text-xs text-slate-500">Fund Migration currently uses the same PayPal payout workflow as ordinary withdrawals. Enter the authorized owner destination; it is validated and persisted server-side.</p>
        <input type="email" value={payoutDest} onChange={(e) => setPayoutDest(e.target.value)} placeholder="owner@example.com" autoComplete="email" className="w-full rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm placeholder:text-slate-600" />
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-slate-400"><span className="text-cyan-300 font-semibold">PayPal</span> is the only migration payout method currently connected to the authoritative withdrawal provider. Cash App and Bitcoin remain outside this workflow until their payout/reconciliation paths are independently verified.</div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="flex-1 text-slate-400" onClick={() => setStep("entries")}>Back</Button>
          <Button className="flex-1 bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30" onClick={() => setStep("confirm")} disabled={!payoutDest.trim()}>Review →</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4 text-cyan-400" /> Fund Migration</h3><p className="text-[11px] text-slate-500 mt-0.5">Record external-platform funds for the campaign owner through the authoritative payout workflow.</p></div></div>
      {pending.length > 0 && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3"><p className="text-xs font-semibold text-amber-300">{pending.length} pending withdrawal{pending.length > 1 ? "s" : ""} awaiting action</p></div>}
      {loadingCampaigns ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div> : <>
        {migrations.map((m, i) => <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex justify-between items-center"><span className="text-xs font-semibold text-slate-300">Migration #{i + 1}</span>{migrations.length > 1 && <button onClick={() => setMigrations((prev) => prev.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-300 p-1" aria-label={`Remove migration ${i + 1}`}><X className="w-3 h-3" /></button>}</div>
          <select value={m.campaignId} onChange={(e) => updateRow(i, "campaignId", e.target.value)} className="w-full rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm"><option value="">Select campaign…</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          <select value={m.sourcePlatform} onChange={(e) => updateRow(i, "sourcePlatform", e.target.value)} className="w-full rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm">{SOURCE_PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}</select>
          <div className="flex items-center gap-2"><span className="text-slate-400 text-sm">$</span><input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" placeholder="Gross amount" value={m.grossAmount} onChange={(e) => updateRow(i, "grossAmount", e.target.value)} className="flex-1 rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm placeholder:text-slate-600" /></div>
        </div>)}
        <button onClick={() => setMigrations((prev) => [...prev, emptyEntry()])} className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 py-1"><Plus className="w-3 h-3" /> Add another migration</button>
        {totalGross > 0 && <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs space-y-1"><div className="flex justify-between text-slate-300"><span>Total gross</span><span className="font-semibold">{fmt(totalGross)}</span></div><div className="flex justify-between text-slate-500"><span>Estimated platform fee</span><span>− {fmt(estimatedPlatformFee)}</span></div><div className="flex justify-between text-emerald-400 font-bold"><span>Estimated net</span><span>{fmt(estimatedNet)}</span></div></div>}
        {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
        <Button className="w-full bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30 rounded-xl h-11" onClick={() => setStep("payout")} disabled={totalGross <= 0}>Continue to payout →</Button>
      </>}
    </div>
  );
}
