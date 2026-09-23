// Canonical PayPal donate link for the Interplanetary Fund — one source of
// truth shared across every Interplanetary Fund repo. Builds a one-click
// donate link that works anywhere (posts, emails, texts, bios); the donor
// picks the amount if none is given. No SDK, no hosted button ID.
//
// Business account: interplanetarysister@gmail.com

import { PRELAUNCH_MODE } from "../../base44/shared/prelaunch.js";

const BUSINESS_EMAIL = "interplanetarysister@gmail.com";

export function generatePayPalLink(campaignTitle, amount) {
  const params = new URLSearchParams({
    cmd: "_donations",
    business: BUSINESS_EMAIL,
    item_name: PRELAUNCH_MODE ? "Interplanetary Fund - Prelaunch Development & Operations" : `${campaignTitle} - Interplanetary Fund`,
    currency_code: "USD",
  });
  if (amount) params.set("amount", String(amount));
  return `https://www.paypal.com/donate/?${params.toString()}`;
}

// Full donation block appended to cross-posted campaign content so a
// clickable PayPal link travels with the post even if copy-pasted.
export function generateDonationBlock(campaignTitle, amount) {
  const link = generatePayPalLink(campaignTitle, amount);
  return PRELAUNCH_MODE
    ? `\n\nSupport Interplanetary Fund during prelaunch: ${link}\nThis payment supports Interplanetary Fund development and operations, not the individual campaign shown.`
    : `\n\n💛 Support this campaign: ${link}\nEvery donation makes a difference. Thank you! 🙏`;
}

// Short version for character-limited platforms (X, etc.).
export function generateShortDonationBlock(campaignTitle) {
  return PRELAUNCH_MODE
    ? `\nSupport Interplanetary Fund (prelaunch; not this campaign): ${generatePayPalLink(campaignTitle)}`
    : `\n💛 Donate: ${generatePayPalLink(campaignTitle)}`;
}