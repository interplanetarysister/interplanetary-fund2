import React from "react";
import { generatePayPalLink } from "@/lib/paypalLink";

// The Interplanetary Fund one-time PayPal donate button. Builds the canonical
// PayPal donate link for the campaign (business: interplanetarysister@gmail.com)
// — the same link used across every Interplanetary Fund repo — and opens it in
// a secure new tab. This is a ONE-TIME payment link; recurring (monthly)
// donations are handled separately via the Stripe subscription checkout.
export default function PayPalDonateButton({ campaignTitle = "Interplanetary Fund", amount, label = "Support this campaign!" }) {
  const href = generatePayPalLink(campaignTitle, amount);
  return (
    <div className="w-full flex flex-col items-center gap-2">
      <a
        href={href}
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