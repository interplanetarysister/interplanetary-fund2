import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageError from "@/components/PageError";
import { Download, Loader2, ReceiptText } from "lucide-react";

const usd = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const isoDate = (date) => date.toISOString().slice(0, 10);

// Admin accounting view: a clean per-donation summary for a date range that
// names the platform that actually processed each payment.
export default function DonationExport() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 86400000);
  const [startDate, setStartDate] = useState(isoDate(monthAgo));
  const [endDate, setEndDate] = useState(isoDate(today));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (start = startDate, end = endDate) => {
    setLoading(true);
    setError("");
    try {
      const { data: result } = await base44.functions.invoke("exportDonationSummary", {
        start_date: start,
        end_date: end,
      });
      if (!result || !Array.isArray(result.rows)) throw new Error("malformed");
      setData(result);
    } catch {
      setError("We couldn't build the donation summary. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, []); // Initial range only; the button re-queries.

  const exportCsv = () => {
    const rows = data?.rows || [];
    if (!rows.length) return;
    const header = ["Date", "Campaign", "Donor", "Platform", "Environment", "Amount USD", "Processing fee", "Platform support", "Total charged", "Verified", "Reference"];
    const body = rows.map((row) => [
      new Date(row.created_date).toISOString().slice(0, 10),
      row.campaign_title,
      row.donor_name,
      row.platform_label,
      row.environment,
      row.amount.toFixed(2),
      row.processing_fee.toFixed(2),
      row.platform_contribution.toFixed(2),
      row.total_charged.toFixed(2),
      row.verified ? "Yes" : "Pending",
      row.reference || "",
    ]);
    const csv = [header, ...body]
      .map((cols) => cols.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `donation-summary-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-6xl min-w-0 px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
          <ReceiptText className="h-5 w-5 text-cyan-600" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">Donation export</h1>
          <p className="mt-1 text-sm text-muted-foreground">Accounting summary of verified donations, including the platform used for each transaction.</p>
        </div>
      </div>

      <form
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
        onSubmit={(event) => { event.preventDefault(); load(startDate, endDate); }}
      >
        <div>
          <Label htmlFor="export-start" className="text-xs">Start date</Label>
          <Input id="export-start" type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full sm:w-44" />
        </div>
        <div>
          <Label htmlFor="export-end" className="text-xs">End date</Label>
          <Input id="export-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full sm:w-44" />
        </div>
        <Button type="submit" disabled={loading} className="min-h-[44px] rounded-xl">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}Apply range
        </Button>
        <Button type="button" variant="outline" onClick={exportCsv} disabled={loading || !(data?.rows || []).length} className="min-h-[44px] rounded-xl">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />Export CSV
        </Button>
      </form>

      {error ? <PageError message={error} onRetry={() => load(startDate, endDate)} /> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={loading}>
            {[
              ["Donations", loading ? "—" : String(data?.totals?.count ?? 0)],
              ["Total giving", loading ? "—" : usd(data?.totals?.gross)],
              ["Processing fees", loading ? "—" : usd(data?.totals?.processing_fees)],
              ["Platform support", loading ? "—" : usd(data?.totals?.platform_contributions)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {!!(data?.totals?.by_platform && Object.keys(data.totals.by_platform).length) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {Object.entries(data.totals.by_platform).map(([platform, total]) => (
                <span key={platform} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs">
                  <span className="font-semibold text-foreground">{data.platform_labels?.[platform] || platform}</span>
                  <span className="tabular-nums text-muted-foreground">{usd(total)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Campaign</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Donor</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Platform</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Fees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden="true" />Building summary…</td></tr>
                ) : (data?.rows || []).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No verified donations in this date range.</td></tr>
                ) : (
                  data.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(row.created_date).toLocaleDateString()}</td>
                      <td className="max-w-[16rem] truncate px-4 py-3 text-foreground">{row.campaign_title}</td>
                      <td className="max-w-[12rem] truncate px-4 py-3 text-foreground">{row.donor_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.platform_label}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{usd(row.amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{usd(row.processing_fee)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Showing verified live donations only. Sandbox test gifts are excluded from accounting totals.</p>
        </>
      )}
    </main>
  );
}