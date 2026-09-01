import React from "react";

// The Interplanetary Fund one-time PayPal donate button. Opens PayPal's
// hosted No-Code Payment page in a secure new tab. This is a ONE-TIME payment
// link — recurring (monthly) donations are handled separately via the Stripe
// subscription checkout, never through this button.
const PAYPAL_PAYMENT_URL = "https://www.paypal.com/ncp/payment/93KDZ85LX7EWY";

export default function PayPalDonateButton({ label = "Support this campaign!" }) {
  return (
    <div className="w-full flex flex-col items-center gap-2">
      <a
        href={PAYPAL_PAYMENT_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} — PayPal (opens in a new tab)`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD140] text-[#003087] font-semibold text-sm min-h-[44px] px-5 py-3 shadow-sm hover:brightness-105 active:scale-[0.99] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#003087]"
      >
        {label}
      </a>
      <section className="flex items-center gap-1 text-[11px] text-stone-400">
        Powered by
        <img
          src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
          alt="PayPal"
          className="h-3"
        />
      </section>
    </div>
  );
}