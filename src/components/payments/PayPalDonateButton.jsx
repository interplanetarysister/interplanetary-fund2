import React, { useEffect, useId, useRef, useState } from "react";
import { loadPayPalHostedButtons } from "./paypalScripts";

// The Interplanetary Fund PayPal donate button. Renders the platform's
// PayPal Hosted Button (hostedButtonId RAN8V9CWQ8JZ2) via the PayPal JS SDK,
// so the button, amount, and funding options are all managed in PayPal's
// dashboard. If the SDK can't load (e.g. another PayPal SDK config is already
// active on the page), it falls back to PayPal's hosted donate link using the
// same button id — so the donate path always works.
const HOSTED_BUTTON_ID = "RAN8V9CWQ8JZ2";

export default function PayPalDonateButton({ label = "Donate now!" }) {
  const containerId = `paypal-container-${useId().replace(/:/g, "")}`;
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPayPalHostedButtons()
      .then(() => {
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        window.paypal
          .HostedButtons({ hostedButtonId: HOSTED_BUTTON_ID })
          .render(`#${containerId}`)
          .catch(() => { if (!cancelled) setFailed(true); });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (ref.current) ref.current.innerHTML = ""; };
  }, [containerId]);

  return (
    <div style={{ display: "grid", justifyItems: "center", alignContent: "start", gap: "0.5rem" }}>
      <div id={containerId} ref={ref} />
      {failed && (
        <a
          href={`https://www.paypal.com/donate/?hosted_button_id=${HOSTED_BUTTON_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textAlign: "center", border: "none", borderRadius: "0.5rem", width: "100%",
            padding: "0 2rem", height: "2.75rem", fontWeight: "bold",
            backgroundColor: "#FFD140", color: "#000000",
            fontFamily: '"Helvetica Neue",Arial,sans-serif', fontSize: "1rem",
            display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
          }}
        >
          {label}
        </a>
      )}
      <section style={{ fontSize: "0.75rem" }}>
        Powered by{" "}
        <img
          src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
          alt="paypal"
          style={{ height: "0.875rem", verticalAlign: "middle" }}
        />
      </section>
    </div>
  );
}