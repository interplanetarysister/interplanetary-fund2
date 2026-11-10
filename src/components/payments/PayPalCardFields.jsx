import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadPayPalSdk } from "./paypalScripts";
import { CreditCard, Loader2 } from "lucide-react";

// PayPal hosts all sensitive card fields in iframes. iFund never sees PAN or CVV.
export default function PayPalCardFields({ campaign, amount, platformContribution, onPaid, onCheckoutStart, onCheckoutEnd }) {
  const nameHost = useRef(null);
  const numberHost = useRef(null);
  const expiryHost = useRef(null);
  const cvvHost = useRef(null);
  const fieldsRef = useRef(null);
  const intentRef = useRef({ key: "", id: "" });
  const callbacks = useRef({ onPaid, onCheckoutStart, onCheckoutEnd });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { callbacks.current = { onPaid, onCheckoutStart, onCheckoutEnd }; });

  useEffect(() => {
    let cancelled = false;
    const value = Number(amount);
    if (!campaign?.id || !Number.isFinite(value) || value < 1) { setStatus("unavailable"); return; }
    const key = [campaign.id, value.toFixed(2), "card", platformContribution ? "1" : "0"].join("|");
    if (intentRef.current.key !== key) intentRef.current = { key, id: crypto.randomUUID() };
    const intentId = intentRef.current.id;
    const boot = async () => {
      setStatus("loading"); setError("");
      try {
        const { data: config } = await base44.functions.invoke("getPayPalConfig", {});
        if (cancelled) return;
        if (config?.environment !== "live" || config?.api_live !== true || !config?.client_id) {
          setStatus("unavailable"); return;
        }
        await loadPayPalSdk(config.client_id);
        if (cancelled) return;
        if (typeof window.paypal?.CardFields !== "function") { setStatus("unavailable"); return; }
        const cardFields = window.paypal.CardFields({
          createOrder: async () => {
            const { data } = await base44.functions.invoke("createPayPalOrder", {
              campaign_id: campaign.id, amount: value, platform_contribution: Boolean(platformContribution),
              intent_id: intentId, payment_channel: "card",
            });
            if (!data?.id || data.environment !== "live" || data.test_mode) throw new Error("Unable to establish a verified payment intent.");
            return data.id;
          },
          onApprove: async (data) => {
            if (!data?.orderID) throw new Error("PayPal did not return an order ID.");
            setStatus("capturing");
            try {
              const { data: result } = await base44.functions.invoke("capturePayPalOrder", {
                order_id: data.orderID, campaign_id: campaign.id,
                donor_name: "", message: "", is_recurring: false,
              });
              if (result?.ok !== true || !result.canonical_operation_id) {
                throw new Error("Capture requires reconciliation.");
              }
              if (!cancelled) { setStatus("ready"); callbacks.current.onPaid?.(result); }
            } catch (captureError) {
              if (!cancelled) {
                setStatus("error");
                setError(captureError?.response?.data?.error || "Payment verification is pending. Check your receipt before trying another payment.");
              }
            } finally { callbacks.current.onCheckoutEnd?.(); }
          },
          onError: () => {
            callbacks.current.onCheckoutEnd?.();
            if (!cancelled) { setStatus("error"); setError("Card checkout was not completed. No donation was added."); }
          },
          onCancel: () => { callbacks.current.onCheckoutEnd?.(); if (!cancelled) setStatus("ready"); },
        });
        if (!cardFields.isEligible()) { if (!cancelled) setStatus("unavailable"); return; }
        fieldsRef.current = cardFields;
        await Promise.all([
          cardFields.NameField().render(nameHost.current),
          cardFields.NumberField().render(numberHost.current),
          cardFields.ExpiryField().render(expiryHost.current),
          cardFields.CVVField().render(cvvHost.current),
        ]);
        if (!cancelled) setStatus("ready");
      } catch (_) {
        if (!cancelled) { setStatus("error"); setError("Secure card fields could not load. You can try PayPal checkout instead."); }
      }
    };
    boot();
    return () => {
      cancelled = true;
      fieldsRef.current = null;
      for (const node of [nameHost.current, numberHost.current, expiryHost.current, cvvHost.current]) {
        try { node?.replaceChildren(); } catch (_) {}
      }
    };
  }, [campaign?.id, amount, platformContribution, attempt]);

  const cardField = "min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
  return <section className="space-y-3" aria-label="Secure credit or debit card donation">
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><CreditCard className="h-4 w-4" /> Pay with a card — no PayPal account required</div>
    {status === "loading" && <p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" /> Loading secure card entry…</p>}
    <div className={status === "unavailable" ? "hidden" : "space-y-3"}>
      <label className="block text-xs font-medium">Name on card<div className={cardField} ref={nameHost} /></label>
      <label className="block text-xs font-medium">Card number<div className={cardField} ref={numberHost} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium">Expiration<div className={cardField} ref={expiryHost} /></label>
        <label className="block text-xs font-medium">Security code<div className={cardField} ref={cvvHost} /></label>
      </div>
      <button type="button" className="min-h-12 w-full rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50"
        disabled={status !== "ready"}
        onClick={async () => {
          setError(""); callbacks.current.onCheckoutStart?.();
          try { await fieldsRef.current?.submit(); }
          catch (_) { setError("Card authorization failed. Check your details and try again."); setStatus("ready"); callbacks.current.onCheckoutEnd?.(); }
        }}>
        {status === "capturing" ? "Verifying payment…" : "Donate securely with card"}
      </button>
    </div>
    {status === "unavailable" && <p role="status" className="text-xs text-slate-500">Card entry is not available for this merchant or device. PayPal checkout may still offer guest card payment.</p>}
    {error && <div role="alert" className="space-y-1"><p className="text-xs text-red-700">{error}</p><button className="text-xs underline" onClick={() => setAttempt(n => n + 1)}>Retry secure card checkout</button></div>}
    <p className="text-[11px] text-slate-500">Card data is entered directly in PayPal-hosted fields and is never stored by iFund.</p>
  </section>;
}
