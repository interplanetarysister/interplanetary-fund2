import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import DonationRow from "@/components/giving/DonationRow";
import PageError from "@/components/PageError";
import { Compass, HeartHandshake, ReceiptText, FlaskConical, ShieldCheck, Loader2, RefreshCw, Info, Sparkles } from "lucide-react";

const usd = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const modes = [{ key: "live", title: "Live giving" }, { key: "sandbox", title: "Sandbox demo" }];

export default function MyGiving() {
  const [donations, setDonations] = useState(null);
  const [mode, setMode] = useState("sandbox");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("getMyGiving", {});
      if (!data || !Array.isArray(data.donations)) throw new Error("Invalid response");
      setDonations(data.donations);
    } catch (_) {
      setError("Your verified giving history is unavailable. No amounts are being estimated.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const records = useMemo(() => (donations || []).filter(d => d.environment === mode), [donations, mode]);
  const completed = records.filter(d => d.status === "completed" && d.currency === "USD");
  const lifetime = completed.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const supported = new Set(completed.map(d => d.campaign_id).filter(Boolean)).size;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="font-display text-3xl sm:text-4xl text-foreground">My Giving</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your campaign contributions, verified by the payment provider.</p></div>
        <span className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${mode === "sandbox" ? "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-border bg-card text-foreground"}`}>
          {mode === "sandbox" ? <FlaskConical className="h-4 w-4" aria-hidden="true"/> : <ShieldCheck className="h-4 w-4" aria-hidden="true"/>}
          {mode === "sandbox" ? "SANDBOX · TEST FUNDS" : "LIVE · REAL PAYMENTS"}
        </span>
      </div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Giving environment">
        {modes.map(m => <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => setMode(m.key)}
          className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${mode === m.key ? "border-cyan-400 bg-cyan-500/15 text-foreground" : "border-border bg-card text-muted-foreground"}`}>{m.title}</button>)}
      </div>
      {mode === "sandbox" && <p role="status" className="mb-5 flex gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-foreground">
        <Info className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true"/>Sandbox payments use simulated funds. They never contribute to live campaign totals or withdrawals.</p>}
      {error ? <PageError message={error} onRetry={load}/> : <>
        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy={loading}>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><HeartHandshake className="h-5 w-5 text-cyan-500" aria-hidden="true"/>Lifetime Giving</div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{loading ? "—" : usd(lifetime)}</div>
            <p className="mt-1 text-xs text-muted-foreground">USD · {mode === "sandbox" ? "test captures" : "verified live gifts"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Compass className="h-5 w-5 text-violet-500" aria-hidden="true"/>Campaigns Supported</div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{loading ? "—" : supported}</div>
            <p className="mt-1 text-xs text-muted-foreground">Unique campaigns with completed gifts</p>
          </div>
        </div>
        <section aria-labelledby="giving-history-heading" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="giving-history-heading" className="flex items-center gap-2 text-xl font-semibold text-foreground"><ReceiptText className="h-5 w-5 text-cyan-500" aria-hidden="true"/>Donation history</h2>
            <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-cyan-400">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/> : <RefreshCw className="h-4 w-4" aria-hidden="true"/>}Refresh history
            </button>
          </div>
          {loading ? <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true"/>Loading verified payments…</div> : records.length === 0 ?
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <HeartHandshake className="h-12 w-12 text-cyan-500" aria-hidden="true"/>
              <p className="font-semibold text-foreground">No {mode === "sandbox" ? "sandbox" : "confirmed"} donations yet</p>
              <p className="max-w-md text-sm text-muted-foreground">Find a cause on Discover. Only confirmed, verified captures count toward your totals.</p>
              <Link to="/discover" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 font-semibold text-white hover:bg-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500">
                <Compass className="h-4 w-4" aria-hidden="true"/>Find campaigns</Link>
            </div> :
            <div className="divide-y divide-border">{records.map(d => <DonationRow key={d.id} donation={d}/>)}</div>}
        </section>
      </>}
      <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 shrink-0 text-violet-400" aria-hidden="true"/>Optional platform support is separate from campaign giving and is unavailable here until its own checkout is verified.</p>
    </main>
  );
}