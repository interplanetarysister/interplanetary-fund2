import React, { Suspense, lazy, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Wallet, ReceiptText, BookOpen, Users } from "lucide-react";

const FinancialLedger = lazy(() => import("./FinancialLedger"));
const MyGiving = lazy(() => import("./MyGiving"));
const Withdrawals = lazy(() => import("./Withdrawals"));
const Donors = lazy(() => import("./Donors"));

// All financial tools share one protected route, but each tab loads the
// existing owner-scoped backend independently. Never join sandbox totals to
// live giving or expose withdrawals on a public campaign page.
const TABS = [
  { id:"ledger", label:"Financial ledger", icon:BookOpen, component:FinancialLedger },
  { id:"giving", label:"My giving", icon:ReceiptText, component:MyGiving },
  { id:"withdrawals", label:"Withdrawals", icon:Wallet, component:Withdrawals },
  { id:"supporters", label:"Supporters", icon:Users, component:Donors },
];
export default function FinanceCenter() {
  const [params,setParams] = useSearchParams();
  const view = TABS.some(tab=>tab.id === params.get("view")) ? params.get("view") : "ledger";
  const current = TABS.find(tab=>tab.id === view);
  const ActivePanel = current.component;
  const select = id => {
    const next = new URLSearchParams(params);
    next.set("view",id);
    setParams(next);
  };
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-6">
    <header className="space-y-2">
      <h1 className="font-display text-3xl font-semibold text-foreground">Financial center</h1>
      <p className="text-sm text-muted-foreground">Your private verified campaign balances, ledger records, donation receipts and payout status together. Live and sandbox records remain separately identified.</p>
    </header>
    <nav className="flex flex-wrap gap-2" aria-label="Financial center views">
      {TABS.map(tab=><button key={tab.id} type="button" onClick={()=>select(tab.id)}
        aria-current={view===tab.id ? "page" : undefined}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${view===tab.id ? "border-cyan-400 bg-cyan-500/15 text-foreground" : "border-border bg-card text-muted-foreground"}`}>
        <tab.icon className="h-4 w-4" aria-hidden="true"/>{tab.label}
      </button>)}
    </nav>
    <Suspense fallback={<p role="status" className="p-5">Loading your financial records…</p>}>
      <ActivePanel />
    </Suspense>
    <p className="text-xs text-muted-foreground">Only server-authorized records are shown. Payout availability is controlled by your actual verified balance and provider readiness, not this page.</p>
  </main>;
}
