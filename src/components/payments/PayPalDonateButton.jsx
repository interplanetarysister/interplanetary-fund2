import React from "react";

// The Interplanetary Fund PayPal donate button. Opens PayPal's hosted donate
// page, where supporters can choose one-time, monthly, or yearly giving and
// pick a purpose (e.g. AI subscription). Accepts PayPal balance and cards.
export default function PayPalDonateButton({ label = "Donate now!" }) {
  return (
    <div>
      <style>{`.pp-donate{text-align:center;border:none;border-radius:0.5rem;min-width:11.625rem;width:100%;padding:0 2rem;height:2.75rem;font-weight:bold;background-color:#FFD140;color:#000000;font-family:"Helvetica Neue",Arial,sans-serif;font-size:1rem;line-height:1.25rem;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;}`}</style>
      <div style={{ display: "grid", justifyItems: "center", alignContent: "start", gap: "0.5rem" }}>
        <a
          className="pp-donate"
          href="https://www.paypal.com/donate/?hosted_button_id=7C7AD6XGKSM86"
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>
        <img src="https://www.paypalobjects.com/images/Debit_Credit_APM.svg" alt="cards" />
        <section style={{ fontSize: "0.75rem" }}>
          Powered by{" "}
          <img
            src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
            alt="paypal"
            style={{ height: "0.875rem", verticalAlign: "middle" }}
          />
        </section>
      </div>
    </div>
  );
}