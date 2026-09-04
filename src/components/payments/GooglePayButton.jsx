import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadPayPalSdk, loadGooglePayScript } from "./paypalScripts";
import { computeChargeTotal } from "../../../base44/shared/fees.js";

// Google Pay donations processed through the platform's PayPal business
// account (PayPal JS SDK v6 + Google Pay). Flow: create a PayPal order,
// confirm it with the buyer's Google Pay payment data, then capture and
// record the gift. The button only renders when Google Pay is available on
// the buyer's device; otherwise it degrades silently to the PayPal/card
// options already shown above it.
export default function GooglePayButton({ campaign, amount, donorName, message, recurring, platformContribution, onPaid }) {
  const containerRef = useRef(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");

  // Volatile props (name/message/recurring/callback) are read via a ref so the
  // Google Pay client is only rebuilt when the amount or campaign changes.
  const propsRef = useRef({ donorName, message, recurring, platformContribution, onPaid });
  useEffect(() => { propsRef.current = { donorName, message, recurring, platformContribution, onPaid }; });

  useEffect(() => {
    let cancelled = false;
    let buttonEl = null;

    async function init() {
      const value = parseFloat(amount);
      if (!value || value <= 0) { setState("noamount"); return; }

      let config;
      try {
        const { data } = await base44.functions.invoke("getPayPalConfig", {});
        config = data;
      } catch (e) {
        if (!cancelled) { setState("error"); setError("Payment setup failed."); }
        return;
      }
      if (cancelled) return;
      if (!config?.client_id) { setState("unavailable"); return; }

      try {
        await Promise.all([loadPayPalSdk(config.client_id), loadGooglePayScript()]);
      } catch (e) {
        if (!cancelled) { setState("error"); setError("Couldn't load payment."); }
        return;
      }
      if (cancelled) return;

      const paypal = window.paypal;
      const google = window.google;
      if (!paypal?.createInstance || !google?.payments?.api) { setState("unavailable"); return; }

      let instance;
      try {
        instance = await paypal.createInstance({
          clientId: config.client_id,
          components: ["googlepay-payments"],
          pageType: "checkout",
        });
      } catch (e) { if (!cancelled) setState("unavailable"); return; }

      let methods;
      try { methods = await instance.findEligibleMethods({ currencyCode: "USD" }); }
      catch (e) { if (!cancelled) setState("unavailable"); return; }
      if (!methods?.isEligible || !methods.isEligible("googlepay")) { setState("unavailable"); return; }
      if (cancelled) return;

      const details = methods.getDetails("googlepay");
      const session = instance.createGooglePayOneTimePaymentSession();
      const gpayConfig = session.formatConfigForPaymentRequest(details.config);

      const env = config.mode === "live" ? "PRODUCTION" : "TEST";
      const paymentsClient = new google.payments.api.PaymentsClient({
        environment: env,
        paymentDataCallbacks: {
          onPaymentAuthorized: async (paymentData) => {
            try {
              const p = propsRef.current;
              // The optional platform-contribution choice is bound into the
              // PayPal order's server-generated custom_id here. Capture does
              // not trust a post-payment client value for financial allocation.
              const { data: order } = await base44.functions.invoke("createPayPalOrder", {
                campaign_id: campaign.id,
                amount: value,
                platform_contribution: !!p.platformContribution,
              });
              if (order?.error) return { transactionState: "ERROR", error: { message: order.error } };

              const { status } = await session.confirmOrder({
                orderId: order.id,
                paymentMethodData: paymentData.paymentMethodData,
              });

              if (status !== "PAYER_ACTION_REQUIRED") {
                const { data: cap } = await base44.functions.invoke("capturePayPalOrder", {
                  order_id: order.id,
                  campaign_id: campaign.id,
                  donor_name: p.donorName || "Anonymous",
                  message: p.message,
                  is_recurring: !!p.recurring,
                });
                if (cap?.error) return { transactionState: "ERROR", error: { message: cap.error } };
                if (!cancelled) p.onPaid?.(cap);
              }
              return { transactionState: "SUCCESS" };
            } catch (err) {
              return { transactionState: "ERROR", error: { message: err.message || "Payment failed" } };
            }
          },
        },
      });

      const { result } = await paymentsClient.isReadyToPay({
        allowedPaymentMethods: gpayConfig.allowedPaymentMethods,
        apiVersion: gpayConfig.apiVersion,
        apiVersionMinor: gpayConfig.apiVersionMinor,
      });
      if (!result || cancelled) { if (!cancelled) setState("unavailable"); return; }

      buttonEl = paymentsClient.createButton({
        onClick: () => {
          paymentsClient.loadPaymentData({
            ...gpayConfig,
            transactionInfo: {
              countryCode: gpayConfig.countryCode,
              currencyCode: "USD",
              totalPriceStatus: "FINAL",
              totalPrice: computeChargeTotal(value).toFixed(2),
            },
            callbackIntents: ["PAYMENT_AUTHORIZATION"],
          });
        },
      });
      if (cancelled) return;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(buttonEl);
      }
      setState("ready");
    }

    init();
    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [amount, campaign.id]);

  if (state === "noamount" || state === "loading" || state === "unavailable") return null;
  return (
    <div>
      <div ref={containerRef} className="gpay-host [&_button]:w-full" />
      {state === "error" && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
    </div>
  );
}
