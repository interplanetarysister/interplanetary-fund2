import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadPayPalSdk } from "./paypalScripts";

export default function PayPalCheckoutButton({ campaign, amount, donorName, message, platformContribution, onPaid }) {
  const containerRef = useRef(null);
  const buttonsRef = useRef(null);
  const intentRef = useRef(crypto.randomUUID());
  const [error, setError] = useState("");
  const latestRef = useRef({ donorName, message, onPaid });
  useEffect(() => { latestRef.current = { donorName, message, onPaid }; });

  useEffect(() => {
    // Changing a campaign, amount or contribution must use a new server order key.
    intentRef.current = crypto.randomUUID();
    let cancelled = false;
    const node = containerRef.current;
    if (!node || !campaign?.id || !amount || Number(amount) <= 0) return undefined;

    (async () => {
      try {
        setError("");
        const { data: config } = await base44.functions.invoke("getPayPalConfig", {});
        if (cancelled || config?.api_configured !== true || !config?.client_id) {
          if (!cancelled) setError("PayPal checkout is not available right now.");
          return;
        }
        await loadPayPalSdk(config.client_id);
        if (cancelled || !window.paypal?.Buttons) throw new Error("PayPal buttons unavailable");
        node.replaceChildren();
        const buttons = window.paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal" },
          createOrder: async () => {
            const { data } = await base44.functions.invoke("createPayPalOrder", {
              campaign_id: campaign.id,
              amount: Number(amount),
              platform_contribution: !!platformContribution,
              intent_id: intentRef.current,
              payment_channel: "paypal",
            });
            if (!data?.id) throw new Error("Order creation failed");
            return data.id;
          },
          onApprove: async (data) => {
            const orderId = data?.orderID;
            if (!orderId) throw new Error("Missing PayPal order");
            const { donorName: latestName, message: latestMessage, onPaid: latestOnPaid } = latestRef.current;
            const { data: result } = await base44.functions.invoke("capturePayPalOrder", {
              order_id: orderId,
              campaign_id: campaign.id,
              donor_name: latestName || "",
              message: latestMessage || "",
              is_recurring: false,
            });
            if (result?.ok !== true || !result?.canonical_operation_id) throw new Error("Capture not confirmed");
            if (!cancelled) latestOnPaid?.(result);
          },
          onError: () => { if (!cancelled) setError("PayPal could not complete the payment. Please try again."); },
          onCancel: () => { if (!cancelled) setError(""); },
        });
        buttonsRef.current = buttons;
        await buttons.render(node);
      } catch (_) {
        if (!cancelled) setError("PayPal checkout is not available right now. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
      try { buttonsRef.current?.close?.(); } catch (_) {}
      buttonsRef.current = null;
      node.replaceChildren();
    };
  }, [campaign?.id, amount, platformContribution]);

  return <div className="space-y-2"><div ref={containerRef} aria-label="PayPal checkout" />{error && <p role="status" className="text-xs text-red-600">{error}</p>}</div>;
}
