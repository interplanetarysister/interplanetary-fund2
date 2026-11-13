import React from "react";
import { IFUND_PLATFORM_SUPPORT_PAYMENT_LINK } from "@/lib/paypalLink";

// Platform support uses the owner's official PayPal payment-link checkout.
// Do not inject a second PayPal SDK into campaign, financial or account pages:
// PayPal HostedButtons may be unavailable for this merchant and can conflict
// with the verified campaign checkout SDK. The provider handles the payment.
export default function PlatformSupportHostedButton() {
  return (
    <section aria-label="Support Interplanetary Fund" className="mx-auto w-full max-w-xl px-4 py-8 text-center">
      <h2 className="text-lg font-semibold">Fuel the Interplanetary Fund mission</h2>
      <p className="mt-2 mb-5 text-sm text-muted-foreground">
        Suggested $25 one-time support for Interplanetary Fund operations.
        This payment does not contribute to any individual campaign.
      </p>
      <a href={IFUND_PLATFORM_SUPPORT_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
        aria-label="Donate to Interplanetary Fund using live PayPal checkout"
        className="mx-auto inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-[#FFC439] px-5 py-3 text-sm font-bold text-[#003087] shadow-md hover:bg-[#f4b72d] focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">
        Donate to IFund with PayPal
      </a>
      <p className="mt-2 text-xs text-muted-foreground">
        PayPal securely displays the final amount and available payment methods
        before you approve. Platform support does not fund an individual campaign.
      </p>
    </section>
  );
}
