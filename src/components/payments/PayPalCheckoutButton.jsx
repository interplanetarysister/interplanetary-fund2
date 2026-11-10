import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadPayPalSdk } from "./paypalScripts";
import { Loader2, RotateCcw } from "lucide-react";

// PayPal Buttons for the campaign checkout. The browser only ever starts an
// order and asks the server to capture it; an approval callback or a success
// page visit never marks a donation paid. Sandbox demo use is labeled so test
// money can never be mistaken for a real gift.
export default function PayPalCheckoutButton({ campaign, amount, donorName, message, platformContribution, onPaid, onCheckoutStart, onCheckoutEnd, testMode = false }) {
  const containerRef = useRef(null);
  const buttonsRef = useRef(null);
  const intentRef = useRef({ key: "", id: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | ready | capturing | error
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const latestRef = useRef({ donorName, message, onPaid, onCheckoutStart, onCheckoutEnd });
  useEffect(() => { latestRef.current = { donorName, message, onPaid, onCheckoutStart, onCheckoutEnd }; });

  useEffect(() => {
    let cancelled = false;
    const node = containerRef.current;
    if (!node || !campaign?.id || !amount || Number(amount) <= 0) return undefined;
    const value = Number(amount);
    const selectedContribution = !!platformContribution;
    const financialIntentKey = [campaign.id, value.toFixed(2), "paypal", selectedContribution ? "1" : "0"].join("|");
    if (intentRef.current.key !== financialIntentKey) {
      intentRef.current = { key: financialIntentKey, id: crypto.randomUUID() };
    }
    const intentId = intentRef.current.id;

    (async () => {
      try {
        setStatus("loading");
        setError("");
        setNotice("");
        const { data: config } = await base44.functions.invoke("getPayPalConfig", {});
        if (cancelled) return;
        if (config?.api_configured !== true || !config?.client_id) {
          setStatus("error");
          setError(config?.environment === "sandbox"
            ? "PayPal sandbox is not configured yet, so the test checkout cannot load."
            : "PayPal checkout is not available right now.");
          return;
        }
        if (isSandboxTarget(config) !== Boolean(testMode)) {
          // Never let a live client id render a "sandbox" label or vice versa.
          setStatus("error");
          setError("This checkout's PayPal environment does not match. Please reload the page.");
          return;
        }
        await loadPayPalSdk(config.client_id);
        if (cancelled || !window.paypal?.Buttons) throw new Error("PayPal buttons unavailable");
        node.replaceChildren();
        const buttons = window.paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal", height: 44, tagline: false },
          // PayPal opens outside Radix's dialog focus scope. Release the modal trap
          // before authentication so its popup can accept keyboard and touch input.
          onClick: () => latestRef.current.onCheckoutStart?.(),
          createOrder: async () => {
            setError("");
            const { data } = await base44.functions.invoke("createPayPalOrder", {
              campaign_id: campaign.id,
              amount: value,
              platform_contribution: selectedContribution,
              intent_id: intentId,
              payment_channel: "paypal",
            });
            if (!data?.id) throw new Error("Order creation failed");
            if (data.test_mode !== Boolean(testMode)) throw new Error("Environment mismatch");
            return data.id;
          },
          onApprove: async (approval) => {
            latestRef.current.onCheckoutEnd?.();
            const orderId = approval?.orderID;
            if (!orderId) { setError("PayPal did not return an order. Please try again."); return; }
            setStatus("capturing");
            setError("");
            try {
              const { data: result } = await base44.functions.invoke("capturePayPalOrder", {
                order_id: orderId,
                campaign_id: campaign.id,
                donor_name: latestRef.current.donorName || "",
                message: latestRef.current.message || "",
                is_recurring: false,
              });
              if (result?.ok !== true || !result?.canonical_operation_id) throw new Error("Capture not confirmed");
              setStatus("ready");
              if (!cancelled) latestRef.current.onPaid?.(result);
            } catch (captureError) {
              const serverMessage = captureError?.response?.data?.error || captureError?.data?.error || "";
              setStatus("error");
              setError(serverMessage || "We couldn't confirm the payment with PayPal. You were not charged twice; check your PayPal activity before retrying.");
            }
          },
          onError: () => {
            latestRef.current.onCheckoutEnd?.();
            setStatus("error");
            setError("PayPal could not complete the payment. Nothing was added to the campaign.");
          },
          onCancel: () => {
            latestRef.current.onCheckoutEnd?.();
            setStatus("ready");
            setError("");
            setNotice("Payment cancelled. Nothing was charged.");
          },
        });
        buttonsRef.current = buttons;
        await buttons.render(node);
        if (!cancelled) setStatus("ready");
      } catch (_) {
        if (!cancelled) {
          setStatus("error");
          setError("The PayPal checkout could not load. Check your connection and try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
      try { buttonsRef.current?.close?.(); } catch (_) {}
      buttonsRef.current = null;
      node.replaceChildren();
    };
  }, [campaign?.id, amount, platformContribution, testMode, retryNonce]);

  return (
    <div className="w-full min-w-0 space-y-2">
      {testMode && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900">
          Sandbox test checkout — no real money
        </p>
      )}
      {(status === "loading" || status === "capturing") && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {status === "capturing" ? "Confirming the payment with the server…" : "Loading PayPal…"}
        </p>
      )}
      <div ref={containerRef} className="w-full min-w-0 overflow-visible [&_iframe]:max-w-full" aria-label={testMode ? "PayPal sandbox test checkout" : "PayPal checkout"} />
      {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
      {error && (
        <div role="alert" className="space-y-1">
          <p className="text-xs text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => { setError(""); setNotice(""); setStatus("idle"); setRetryNonce((n) => n + 1); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline"
          >
            <RotateCcw className="w-3 h-3" /> Try again
          </button>
        </div>
      )}
    </div>
  );
}

// The SDK must match the server's environment. Never accept a live client id
// for a sandbox-labeled button (or the reverse).
function isSandboxTarget(config) {
  return config?.environment === "sandbox" && config?.test_mode === true;
}