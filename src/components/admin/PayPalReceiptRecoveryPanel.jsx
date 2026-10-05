import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw, WalletCards } from "lucide-react";
import { getFrontendIdentity } from "@/lib/adminBootstrap";

export default function PayPalReceiptRecoveryPanel({ user }) {
  const superAdmin = getFrontendIdentity(user).superAdminOwner;
  const [receipts, setReceipts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selection, setSelection] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!superAdmin) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [receiptResponse, campaignRows] = await Promise.all([
        base44.functions.invoke("listUntrackedPayPalReceipts", { lookback_days: 30 }),
        base44.entities.Campaign.list("-created_date", 300),
      ]);
      const data = receiptResponse?.data || {};
      const rows = Array.isArray(data.receipts) ? data.receipts.filter((row) => row.tracked !== true) : [];
      setReceipts(rows);
      setCampaigns(Array.isArray(campaignRows) ? campaignRows : []);
    } catch (e) {
      console.error("PayPal receipt recovery load failed:", e?.name || "UnknownError");
      setError("Untracked PayPal receipts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [superAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!superAdmin) return null;

  const recover = async (receipt) => {
    const campaignId = selection[receipt.transaction_id];
    if (!campaignId || busy) return;
    setBusy(receipt.transaction_id);
    setError("");
    setMessage("");
    try {
      const response = await base44.functions.invoke("reconcileDirectPayPalCampaignDonation", {
        paypal_transaction_id: receipt.transaction_id,
        campaign_id: campaignId,
      });
      const data = response?.data || {};
      if (data.ok !== true) throw new Error("Recovery rejected");
      setReceipts((current) => current.filter((row) => row.transaction_id !== receipt.transaction_id));
      setMessage(data.duplicate
        ? "That PayPal receipt was already safely allocated."
        : `Recovered $${Number(data.campaign_amount || 0).toFixed(2)} to the selected campaign.`);
    } catch (e) {
      console.error("PayPal receipt recovery failed:", e?.name || "UnknownError");
      setError("That receipt could not be assigned safely. It was left unchanged.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-slate-950">
            <WalletCards className="w-5 h-5 text-cyan-700" /> Untracked PayPal receipts
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Recovery for settled PayPal donation-link payments that bypassed IFund checkout. Choose the campaign each verified receipt was intended for. A PayPal transaction can be allocated only once.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading || !!busy} className="rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
          Scan PayPal
        </Button>
      </div>

      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      {loading ? (
        <div className="py-8 flex items-center justify-center text-sm text-slate-600">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking settled donation receipts…
        </div>
      ) : receipts.length === 0 ? (
        <p className="py-6 text-sm text-slate-600">No untracked settled PayPal donation receipts were found in the last 30 days.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {receipts.map((receipt) => (
            <div key={receipt.transaction_id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">
                    ${Number(receipt.gross_amount || 0).toFixed(2)} PayPal donation
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      → ${Number(receipt.recoverable_amount || 0).toFixed(2)} campaign value
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 break-all">
                    {receipt.occurred_at ? new Date(receipt.occurred_at).toLocaleString() : "Date unavailable"} · PayPal fee ${Number(receipt.fee_amount || 0).toFixed(2)} · {receipt.transaction_id}
                  </p>
                  {(receipt.subject || receipt.note) && (
                    <p className="mt-1 text-xs text-slate-600">{receipt.subject || receipt.note}</p>
                  )}
                </div>
                <select
                  aria-label="Campaign for PayPal receipt"
                  value={selection[receipt.transaction_id] || ""}
                  onChange={(event) => setSelection((current) => ({ ...current, [receipt.transaction_id]: event.target.value }))}
                  className="min-h-10 min-w-0 lg:w-72 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  <option value="">Choose campaign…</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.title || "Untitled campaign"}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => recover(receipt)}
                  disabled={!selection[receipt.transaction_id] || !!busy}
                  className="rounded-xl shrink-0"
                >
                  {busy === receipt.transaction_id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Add to campaign
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
