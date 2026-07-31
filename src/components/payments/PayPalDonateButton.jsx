import React from "react";

// The Interplanetary Fund PayPal donate button. Opens PayPal's hosted, secure
// checkout in a new tab and accepts cards as well as PayPal balances.
export default function PayPalDonateButton({ label = "Donate now!" }) {
  return (
    <div>
      <style>{`.pp-J4RP275X4DB78{text-align:center;border:none;border-radius:0.5rem;min-width:11.625rem;width:100%;padding:0 2rem;height:2.75rem;font-weight:bold;background-color:#FFD140;color:#000000;font-family:"Helvetica Neue",Arial,sans-serif;font-size:1rem;line-height:1.25rem;cursor:pointer;}`}</style>
      <form
        action="https://www.paypal.com/ncp/payment/J4RP275X4DB78"
        method="post"
        target="_blank"
        style={{ display: "grid", justifyItems: "center", alignContent: "start", gap: "0.5rem" }}
      >
        <input className="pp-J4RP275X4DB78" type="submit" value={label} />
        <img src="https://www.paypalobjects.com/images/Debit_Credit_APM.svg" alt="cards" />
        <section style={{ fontSize: "0.75rem" }}>
          Powered by{" "}
          <img
            src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
            alt="paypal"
            style={{ height: "0.875rem", verticalAlign: "middle" }}
          />
        </section>
      </form>
    </div>
  );
}