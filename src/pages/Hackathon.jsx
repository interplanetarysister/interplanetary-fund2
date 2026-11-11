import { useState } from "react";
import { Link } from "react-router-dom";
import DemoJourney from "@/components/hackathon/DemoJourney";
import FinanceDataGrid, { formatUsdCents } from "@/components/finance/FinanceDataGrid";
import { financeDemoRows, demoFinanceStats } from "@/lib/hackathonFinanceDemo.mjs";
import { IFUND_HACKATHON_ENTRY } from "@/lib/ifundHackathonManifest";

const PAYPAL_SANDBOX = "https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/hackathon";
const POSTMAN_COLLECTION = "https://github.com/interplanetarysister/InterplanetaryFund/blob/main/apps/web/public/docs/postman/ifund-paypal-sandbox-readonly.postman_collection.json";
const columns = [
  { field: "id", headerName: "Fictional record", minWidth: 155 },
  { field: "campaign", headerName: "Example campaign", minWidth: 230 },
  { field: "paymentMethod", headerName: "Illustrative channel", minWidth: 195 },
  { field: "status", headerName: "Illustrative status", minWidth: 165 },
  { field: "amountCents", headerName: "Example amount", minWidth: 140, valueFormatter: ({ value }) => formatUsdCents(value) },
  { field: "period", headerName: "Period", minWidth: 115 },
];
const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-300/50 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/10";

export default function Hackathon() {
  const [search, setSearch] = useState("");
  const stats = demoFinanceStats();
  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 pb-24 text-slate-100 sm:py-12">
    <header className="rounded-3xl border border-cyan-400/50 bg-[#090f25] px-5 py-8 sm:px-9">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">PayPal AI Hackathon · Original iFund application</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">The complete Interplanetary Fund guided demo</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">One public walkthrough connects campaign discovery, an AI campaign-writing sample, social distribution preview, verified PayPal sandbox handoff, and an AG Grid Community financial dashboard. All showcased financial records are clearly fictional.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a className={button} href={IFUND_HACKATHON_ENTRY} target="_blank" rel="noopener noreferrer">Open the canonical judge demo</a>
        <Link to="/" className={button}>iFund home</Link>
        <Link to="/globe" className={button}>Interactive campaign globe</Link>
      </div>
      <p className="mt-4 text-xs text-slate-400">For a single shareable Devpost URL, use the canonical judge demo above. This page is the Base44 companion integration; neither page collects live payments during the example walkthrough.</p>
    </header>
    <DemoJourney onFinanceFilter={setSearch}/>
    <section id="sandbox-checkout" className="space-y-3 rounded-2xl border border-cyan-400/40 bg-[#09132c] p-5" aria-label="Verified PayPal sandbox handoff">
      <p className="text-xs font-bold uppercase tracking-[0.17em] text-cyan-300">Step 4 · PayPal developer integration</p>
      <h2 className="text-xl font-bold">Test with PayPal Sandbox</h2>
      <p className="text-sm text-slate-300">Real PayPal Orders v2 sandbox checkout is hosted on IFund's designated Cloudflare preview. It uses a separate Personal sandbox buyer and a real published campaign in the sandbox database. This original Base44 page does not initiate or capture a live PayPal charge.</p>
      <a href={PAYPAL_SANDBOX} target="_blank" rel="noopener noreferrer" className={button}>Open verified sandbox checkout · test money only</a>
      <p className="text-xs text-amber-200">Do not enter a real card or live PayPal account into the sandbox. A fictional example shown elsewhere on this page is not an actual payment receipt.</p>
    </section>
    <section id="finance-demo" className="space-y-4 rounded-2xl border border-cyan-400/40 bg-[#071023] p-5" aria-label="AG Grid Community financial showcase">
      <p className="text-xs font-bold uppercase tracking-[0.17em] text-cyan-300">Step 5 · AG Grid Community sponsor integration</p>
      <h2 className="text-xl font-bold">Interactive finance dashboard</h2>
      <p className="text-sm text-slate-300">The same scenario selected above filters the financial display below. Sort columns, search examples, use pagination, or export a sample CSV. The real member ledger remains account-protected.</p>
      <p role="note" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm font-bold text-amber-100">FICTIONAL EXAMPLES — not PayPal orders, verified gifts, or withdrawable account balances.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-xs text-slate-300">Example records</p><strong className="text-xl">{stats.examples}</strong></div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-xs text-slate-300">Example completions</p><strong className="text-xl">{stats.completed}</strong></div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-xs text-slate-300">Example completed value</p><strong className="text-xl">{formatUsdCents(stats.exampleCapturedCents)}</strong></div>
      </div>
      <label className="block text-sm font-semibold">Search fictional finance records
        <input value={search} onChange={e=>setSearch(e.target.value)} type="search" placeholder="Try a sample campaign or status" className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-white" />
      </label>
      <FinanceDataGrid rows={financeDemoRows} columns={columns} label="Fictional AG Grid Community finance table" search={search} allowExport csvName="ifund-fictional-finance-example.csv" />
      <Link to="/ledger" className={button}>Open my real financial ledger · sign-in required</Link>
    </section>
    <section id="mission-control" className="space-y-4 rounded-2xl border border-cyan-400/40 bg-[#09132c] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.17em] text-cyan-300">Step 6 · iFund integrations and sponsor evidence</p>
      <h2 className="text-xl font-bold">Try the real Base44 platform features</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["/create","Campaign creator","Five title choices, two descriptions, story editing and AI art options"],
          ["/agents","AI team","Specialized campaign and fundraising agents; sign-in required"],
          ["/globe","Interactive globe","Discover campaigns by location"],
          ["/connections","Social connections","Check platform-specific OAuth and distribution options"],
          ["/social","Social feeds","Internal campaign engagement and community posts"],
          ["/ledger","Financial ledger","Protected owner/member financial records"],
        ].map(([to,title,detail])=><Link key={to} to={to} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-700 bg-[#070c1b] p-4 hover:border-cyan-300">
          <strong className="text-cyan-200">{title}</strong><p className="mt-2 text-xs text-slate-300">{detail}</p>
        </Link>)}
      </div>
      <p className="text-sm text-slate-300"><strong>Postman:</strong> read-only PayPal sandbox API health checks are supplied as an importable Postman Collection v2.1. <strong>AG Grid:</strong> the free Community edition renders the sample financial dashboard above. Neither tool creates donations.</p>
      <a href={POSTMAN_COLLECTION} target="_blank" rel="noopener noreferrer" className={button}>View Postman sandbox collection</a>
      <div className="flex flex-wrap gap-3">
        <a href="#journey" className={button}>Restart this guided tour</a>
        <a href={IFUND_HACKATHON_ENTRY} target="_blank" rel="noopener noreferrer" className={button}>Return to canonical judge demo</a>
      </div>
    </section>
  </main>;
}
