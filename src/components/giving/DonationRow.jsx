import React from "react";
import { Link } from "react-router-dom";
import { downloadReceipt } from "@/lib/receipt";
import { ReceiptText, CheckCircle2, Clock3, XCircle, RotateCcw, ShieldAlert } from "lucide-react";

const statuses = {
  completed: { label: "Completed", icon: CheckCircle2, style: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10" },
  pending: { label: "Pending", icon: Clock3, style: "text-amber-700 dark:text-amber-300 bg-amber-500/10" },
  failed: { label: "Failed", icon: XCircle, style: "text-red-700 dark:text-red-300 bg-red-500/10" },
  cancelled: { label: "Cancelled", icon: XCircle, style: "text-muted-foreground bg-muted" },
  refunded: { label: "Refunded", icon: RotateCcw, style: "text-indigo-700 dark:text-indigo-300 bg-indigo-500/10" },
  reversed: { label: "Reversed", icon: ShieldAlert, style: "text-red-700 dark:text-red-300 bg-red-500/10" },
};
export default function DonationRow({ donation }) {
  const status = statuses[donation.status] || statuses.pending;
  const StatusIcon = status.icon;
  const date = donation.created_date && !Number.isNaN(new Date(donation.created_date).getTime())
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(donation.created_date)) : "Date unavailable";
  const amount = new Intl.NumberFormat("en-US", {style:"currency", currency: donation.currency === "USD" ? "USD" : "USD"}).format(Number(donation.amount || 0));
  const eligible = donation.status === "completed" && donation.receipt_available === true;
  return <article className="flex flex-wrap items-center justify-between gap-3 py-4">
    <div className="min-w-0 flex-1">
      {donation.campaign_id ? <Link to={`/campaign/${encodeURIComponent(donation.campaign_id)}`} className="font-semibold text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-cyan-400">{donation.campaign_title || "Campaign"}</Link> : <strong className="text-foreground">Campaign</strong>}
      <p className="mt-1 text-xs text-muted-foreground">{date} · {donation.payment_method || "Payment"} · {donation.environment === "sandbox" ? "Sandbox" : "Live"}</p>
      <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.style}`}><StatusIcon className="h-3.5 w-3.5" aria-hidden="true"/>{status.label}</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="text-right"><p className="font-bold tabular-nums text-foreground">{amount} <span className="text-xs font-normal">{donation.currency || "USD"}</span></p>
        <p className="text-xs text-muted-foreground">{donation.environment === "sandbox" ? "Test only" : "Campaign gift"}</p></div>
      {eligible && <button type="button" onClick={() => downloadReceipt(donation)} aria-label={`Download iFund donation details for ${donation.campaign_title || "campaign"}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-cyan-400"><ReceiptText className="h-5 w-5" aria-hidden="true"/></button>}
    </div>
  </article>;
}