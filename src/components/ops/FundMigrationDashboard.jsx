import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRightLeft, Plus, X, CheckCircle2, AlertCircle } from "lucide-react";

const PAYOUT_OPTIONS = [
  { method: "cashapp", destination: "$unrewound", label: "CashApp", hint: "$unrewound" },
  { method: "paypal", destination: "interplanetarysister@gmail.com", label: "PayPal", hint: "interplanetarysister@gmail.com" },
  { method: "bitcoin", destination: "bc1qfgwz5fasnkml0f2z7ynvw5lk6v77ez66fql3pz", label: "Bitcoin", hint: "bc1qfgwz5fasnkml0f2z7ynvw5lk6v77ez66fql3pz" },
];

const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyEntry = () => ({ campaignId: "", campaignTitle: "", sourcePlatform: "GoFundMe", grossAmount: "" });

// Fund Migration Dashboard — record withdrawals from external platforms,
// apply the IF fee schedule, and route net funds to the campaign owner.
// Uses Base44 entities; no Convex / AI credits required.
export default function FundMigrationDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [pending, setPending] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const [step, setStep] = useState("entries"); // entries | payout | confirm | result
  const [migrations, setMigrations] = useState([emptyEntry()]);
  const [payoutMethod, setPayoutMethod] = useState("cashapp");
  const [payoutDest, setPayoutDest] = useState(PAYOUT_OPTIONS[0].destination);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [c, w] = await Promise.all([
        base44.entities.Campaign.list("-raised_amount", 100),
        base44.entities.Withdrawal.filter({ status: "pending" }),
      ]);
      setCampaigns(c || []);
      setPending(w || []);
      setLoadingCampaigns(false);
    })();
  }, []);

  const addRow = () => setMigrations((m) => [...m, emptyEntry()]);
  const removeRow = (i) => setMigrations((m) => m.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) => {
    setMigrations((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === "campaignId") {
        const camp = campaigns.find((c) => c.id === value);
        if (camp) next[i].campaignTitle = camp.title;
      }
      return next;
    });
  };

  const totalGross = migrations.reduce((s, m) => s + (parseFloat(m.grossAmount) || 0), 0);
  const totalPlatformFee = totalGross * 0.05;
  const totalProcessingFee = totalGross * 0.029 + migrations.length * 0.3;
  const totalNet = totalGross - totalPlatformFee - totalProcessingFee;

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const valid = migrations.filter(
        (m) => m.campaignId && m.campaignTitle && m.sourcePlatform && parseFloat(m.grossAmount) > 0
      );
      if (!valid.length) { setError("Fill in at least one migration entry."); setSubmitting(false); return; }

      // Record each migration as a Withdrawal entity in Base44
      const created = [];
      for (const m of valid) {
        const gross = parseFloat(m.grossAmount);
        const platformFee = gross * 0.05;
        const processingFee = gross * 0.029 + 0.3;
        const net = gross - platformFee - processingFee;
        const w = await base44.entities.Withdrawal.create({
          campaign_id: m.campaignId,
          amount: net,
          gross_amount: gross,
          platform_fee: platformFee,
          processing_fee: processingFee,
          source_platform: m.sourcePlatform,
          payout_method: payoutMethod,
          payout_destination: payoutDest,
          status: "processing",
          notes: `Fund migration from ${m.sourcePlatform}`,
        });
        created.push(w);
      }
      setResult({ created: created.length, totalGross, totalNet });
      setStep("result");
    } catch (e) {
      setError(e?.message || "Migration failed. Please try again.");
    }
    setSubmitting(false);
  };

  if (step === "result") {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <p className="font-display text-lg text-slate-100 mb-1">Migration recorded</p>
        <p className="text-sm text-slate-400">
          {result.created} withdrawal{result.created !== 1 ? "s" : ""} created ·{" "}
          {fmt(result.totalGross)} gross → {fmt(result.totalNet)} net after fees
        </p>
        <Button
          variant="ghost"
          className="mt-5 text-cyan-400 hover:text-cyan-300"
          onClick={() => { setStep("entries"); setMigrations([emptyEntry()]); setResult(null); }}
        >
          New migration
        </Button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Confirm Migration</h3>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
          {migrations.filter((m) => parseFloat(m.grossAmount) > 0).map((m, i) => (
            <div key={i} className="flex justify-between text-slate-300">
              <span>{m.campaignTitle || m.campaignId} · {m.sourcePlatform}</span>
              <span className="font-semibold">{fmt(parseFloat(m.grossAmount))}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-white/10 space-y-1">
            <div className="flex justify-between text-xs text-slate-400"><span>Platform fee (5%)</span><span>− {fmt(totalPlatformFee)}</span></div>
            <div className="flex justify-between text-xs text-slate-400"><span>Processing (2.9% + $0.30/item)</span><span>− {fmt(totalProcessingFee)}</span></div>
            <div className="flex justify-between font-bold text-slate-100"><span>Net to owner</span><span>{fmt(totalNet)}</span></div>
          </div>
          <div className="pt-2 border-t border-white/10 text-xs text-slate-400">
            Payout via <span className="text-cyan-300">{payoutMethod}</span> to <span className="text-cyan-300">{payoutDest}</span>
          </div>
        </div>
        {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 text-slate-400" onClick={() => setStep("payout")} disabled={submitting}>Back</Button>
          <Button className="flex-1 bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Record"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "payout") {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Select Payout Method</h3>
        <div className="space-y-2">
          {PAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.method}
              onClick={() => { setPayoutMethod(opt.method); setPayoutDest(opt.destination); }}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                payoutMethod === opt.method
                  ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <span className="font-semibold">{opt.label}</span>
              <span className="ml-2 text-xs opacity-70">{opt.hint}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="flex-1 text-slate-400" onClick={() => setStep("entries")}>Back</Button>
          <Button className="flex-1 bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30" onClick={() => setStep("confirm")}>
            Review →
          </Button>
        </div>
      </div>
    );
  }

  // Step: entries
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-cyan-400" /> Fund Migration
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Withdraw from external platforms → IF processes fees → net to campaign owner
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <p className="text-xs font-semibold text-amber-300">
            {pending.length} pending withdrawal{pending.length > 1 ? "s" : ""} awaiting action
          </p>
        </div>
      )}

      {loadingCampaigns ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div>
      ) : (
        <>
          {migrations.map((m, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Withdrawal #{i + 1}</span>
                {migrations.length > 1 && (
                  <button onClick={() => removeRow(i)} className="text-rose-400 hover:text-rose-300 p-1">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <select
                value={m.campaignId}
                onChange={(e) => updateRow(i, "campaignId", e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <select
                value={m.sourcePlatform}
                onChange={(e) => updateRow(i, "sourcePlatform", e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm"
              >
                {["GoFundMe", "Kickstarter", "Indiegogo", "Facebook", "GiveSendGo", "CashApp", "PayPal", "Other"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Gross amount"
                  value={m.grossAmount}
                  onChange={(e) => updateRow(i, "grossAmount", e.target.value)}
                  className="flex-1 rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm placeholder:text-slate-600"
                />
              </div>
              {parseFloat(m.grossAmount) > 0 && (
                <p className="text-[11px] text-slate-500">
                  Net ≈ {fmt(parseFloat(m.grossAmount) * 0.921 - 0.3)} after 5% + 2.9% + $0.30
                </p>
              )}
            </div>
          ))}

          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 py-1"
          >
            <Plus className="w-3 h-3" /> Add another withdrawal
          </button>

          {totalGross > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-300"><span>Total gross</span><span className="font-semibold">{fmt(totalGross)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Fees (est.)</span><span>− {fmt(totalPlatformFee + totalProcessingFee)}</span></div>
              <div className="flex justify-between text-emerald-400 font-bold"><span>Net to owner</span><span>{fmt(totalNet)}</span></div>
            </div>
          )}

          {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}

          <Button
            className="w-full bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30 rounded-xl h-11"
            onClick={() => setStep("payout")}
            disabled={totalGross <= 0}
          >
            Continue to payout →
          </Button>
        </>
      )}
    </div>
  );
}
