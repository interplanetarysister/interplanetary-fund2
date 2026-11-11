import React, { useEffect, useRef, useState } from "react";
import { IFUND_PLATFORM_SUPPORT_PAYMENT_LINK } from "@/lib/paypalLink";

// PayPal hosted button supplied by the IFund owner on November 5, 2026.
// This is a fixed $25 platform-support payment, NOT campaign checkout.
const HOSTED_ID = "GT3RRRVBG4E5Y";
const CLIENT_ID = "BAAC5OeGibmx5Rq9xWFqsgzyfLx16xyCz415fe046Giq0E-Y7xqJyf3h2KnTChXWjRMbVnsrowVRDWqJMs";
const SDK_ID = "ifund-paypal-hosted-sdk";

export default function PlatformSupportHostedButton() {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const render = () => {
      if (!active || !container.current || !window.paypal?.HostedButtons) return;
      container.current.replaceChildren();
      try {
        window.paypal.HostedButtons({ hostedButtonId: HOSTED_ID })
          .render(container.current).catch(() => { if (active) setFailed(true); });
      } catch {
        if (active) setFailed(true);
      }
    };
    if (window.paypal?.HostedButtons) render();
    else {
      let script = document.getElementById(SDK_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = SDK_ID;
        script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&components=hosted-buttons&enable-funding=venmo&currency=USD`;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      script.addEventListener("error", () => { if (active) setFailed(true); });
      return () => { active = false; script.removeEventListener("load", render); };
    }
    return () => { active = false; };
  }, []);
  return (
    <section aria-label="Support Interplanetary Fund" className="mx-auto w-full max-w-xl px-4 py-8 text-center">
      <h2 className="text-lg font-semibold">Fuel the Interplanetary Fund mission</h2>
      <p className="mt-2 mb-5 text-sm text-muted-foreground">
        Suggested $25 one-time support for Interplanetary Fund operations.
        This payment does not contribute to any individual campaign.
      </p>
      <div ref={container} id="ifund-platform-support-paypal" className="min-h-[48px]" aria-label="Live PayPal hosted support buttons" />
      <a href={IFUND_PLATFORM_SUPPORT_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
        aria-label="Donate to Interplanetary Fund using live PayPal checkout"
        className="mx-auto mt-3 inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-[#FFC439] px-5 py-3 text-sm font-bold text-[#003087] shadow-md hover:bg-[#f4b72d] focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2">
        Donate to IFund with PayPal
      </a>
      <p className="mt-2 text-xs text-muted-foreground">
        This opens live PayPal checkout. Review the actual amount and available payment methods before approving.
        Platform support does not fund an individual campaign.
      </p>
      {failed && <p role="status" className="text-sm">The embedded button did not load. The direct live PayPal checkout button remains available.</p>}
    </section>
  );
}
