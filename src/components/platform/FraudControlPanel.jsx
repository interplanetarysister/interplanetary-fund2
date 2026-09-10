import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldAlert, CheckCircle2, XCircle, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";

const money = (n) => `$${(Number.isFinite(Number(n)) ? Number(n) : 0).toFixed(2)}`;
const SAFE_LOAD_ERROR = "We couldn't load the fraud control queue. Please try again.";
const SAFE_APPROVAL_ERROR = "We couldn't approve this payout. Please try again.";
const SAFE_DENIAL_ERROR = "We couldn't deny this payout. Please try again.";
const SAFE_UNFREEZE_ERROR = "We couldn't restore this campaign. Please try again.";
const SAFE_FREEZE_ERROR = "We couldn't pause this campaign. Please try again.";

const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
const isArrayOfRecords = (value) => Array.isArray(value) && value.every(isRecord);

// Fraud Control Panel — admin-only surface; server-side authorization remains authoritative.
// Approve/deny pending-review withdrawals; pause/unpause campaigns.
export default function FraudControlPanel() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [denyTarget, setDenyTarget] = useState(null);
  const [denyReason, setDenyReason] = useState("");
  const [freezeTarget, setFreezeTarget] = useState(null);
  const [freezeReason, setFreezeReason] = useState("");
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const busyRef = useRef(new Set());

  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    if (mountedRef.current) {
      setLoading(true);
      setError("");
    }
    try {
      const [w, c] = await Promise.all([
        base44.entities.Withdrawal.filter({ status: "under_review" }),
        base44.entities.Campaign.filter({ status: "paused" }),
      ]);
      if (!mountedRef.current || generation !== generationRef.current) return;
      if (!isArrayOfRecords(w) || !isArrayOfRecords(c)) throw new Error("invalid response");
      setWithdrawals(w);
      setCampaigns(c);
      setError("");
    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return;
      setError(SAFE_LOAD_ERROR);
    } finally {
      if (mountedRef.current && generation === generationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const msg = (ok, text) => {
    if (!mountedRef.current) return;
    if (ok) { setSuccess(text); setError(""); }
    else { setError(text); setSuccess(""); }
  };

  const runOnce = async (key, action, failureMessage) => {
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
    try { await action(); } catch { msg(false, failureMessage); }
    finally { busyRef.current.delete(key); }
  };

  const approve = async (w) => runOnce(`approve:${w.id}`, async () => {
    await base44.entities.Withdrawal.update(w.id, { status: "paid" });
    msg(true, `Approved — ${money(w.net_amount)} payout marked paid.`);
    await load();
  }, SAFE_APPROVAL_ERROR);

  const deny = async (w) => {
    if (!denyReason.trim()) { msg(false, "Reason required to deny payout."); return; }
    await runOnce(`deny:${w.id}`, async () => {
      await base44.entities.Withdrawal.update(w.id, { status: "failed", review_note: denyReason.trim() });
      msg(true, "Payout denied. Funds returned to holding account.");
      setDenyTarget(null);
      setDenyReason("");
      await load();
    }, SAFE_DENIAL_ERROR);
  };

  const unfreeze = async (c) => runOnce(`unfreeze:${c.id}`, async () => {
    await base44.entities.Campaign.update(c.id, { status: "active" });
    msg(true, `Campaign \"${String(c.title || c.id)}\" restored to active.`);
    await load();
  }, SAFE_UNFREEZE_ERROR);

  const freeze = async (campaignId, title) => {
    if (!freezeReason.trim() || !String(campaignId).trim()) { msg(false, "Campaign ID and reason are required to pause campaign."); return; }
    await runOnce(`freeze:${campaignId}`, async () => {
      await base44.entities.Campaign.update(campaignId.trim(), { status: "paused" });
      msg(true, `Campaign \"${String(title || campaignId)}\" paused.`);
      setFreezeTarget(null);
      setFreezeReason("");
      await load();
    }, SAFE_FREEZE_ERROR);
  };

  if (loading && withdrawals.length === 0 && campaigns.length === 0 && !error) {
    return <div className="flex justify-center py-10" role="status" aria-live="polite"><Loader2 className="w-5 h-5 animate-spin text-primary" /><span className="sr-only">Loading fraud control queue</span></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-rose-500" />
        <h2 className="font-display text-xl text-stone-900">Fraud Control</h2>
      </div>

      {error && <p role="alert" className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{error} <button type="button" className="underline ml-1" onClick={load}>Retry</button></p>}
      {success && <p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">{success}</p>}

      <section>
        <h3 className="font-medium text-stone-800 mb-3">Payout Review Queue ({withdrawals.length})</h3>
        {withdrawals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-400 text-sm">No withdrawals pending review.</div>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{money(w.gross_amount)} gross → <span className="text-emerald-700 font-semibold">{money(w.net_amount)} net</span></p>
                    <p className="text-xs text-stone-500 mt-0.5">{String(w.campaign_title || w.campaign_id || "Unknown campaign")} · {String(w.paypal_email || "Protected payout account")}</p>
                    {w.review_note && <p className="text-xs text-amber-600 mt-1">{String(w.review_note)}</p>}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase">Under Review</span>
                </div>

                {denyTarget !== w.id ? (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" variant="ghost" onClick={() => approve(w)}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" className="flex-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100" variant="ghost" onClick={() => setDenyTarget(w.id)}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Deny
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <input type="text" placeholder="Reason for denial (required)" value={denyReason} onChange={(e) => setDenyReason(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-rose-300" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="flex-1 text-stone-500" onClick={() => { setDenyTarget(null); setDenyReason(""); }}>Cancel</Button>
                      <Button size="sm" className="flex-1 bg-rose-600 text-white hover:bg-rose-700" onClick={() => deny(w)} disabled={!denyReason.trim()}>Confirm Denial</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-medium text-stone-800 mb-3">Paused Campaigns ({campaigns.length})</h3>
        {campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-400 text-sm">No campaigns paused.</div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 flex items-center justify-between gap-3">
                <div><p className="font-medium text-stone-900">{String(c.title || c.id)}</p><p className="text-xs text-stone-500">Raised: {money(c.raised_amount)}</p></div>
                <Button size="sm" variant="ghost" className="bg-emerald-50 text-emerald-700 border border-emerald-200" onClick={() => unfreeze(c)}><Unlock className="w-3.5 h-3.5 mr-1" /> Restore</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
        <h3 className="font-medium text-stone-800 mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-rose-500" /> Pause a Campaign</h3>
        {freezeTarget === null ? (
          <Button variant="ghost" size="sm" className="text-rose-600 border border-rose-200 bg-rose-50" onClick={() => setFreezeTarget("")}>Enter campaign ID to pause…</Button>
        ) : (
          <div className="space-y-2">
            <input type="text" placeholder="Campaign ID" value={freezeTarget} onChange={(e) => setFreezeTarget(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-rose-300" />
            <input type="text" placeholder="Reason for pause (required)" value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-rose-300" />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1 text-stone-500" onClick={() => { setFreezeTarget(null); setFreezeReason(""); }}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-rose-600 text-white hover:bg-rose-700" disabled={!freezeTarget?.trim() || !freezeReason.trim()} onClick={() => freeze(freezeTarget, freezeTarget)}>Pause Campaign</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
