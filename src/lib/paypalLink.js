// Prelaunch/platform-support PayPal link. This raw provider URL is never a
// campaign fundraising path because it cannot create IFund's canonical
// campaign/payment identity. Campaign donations must return to IFund checkout.
//
// Business account: interplanetarysister@gmail.com


export const IFUND_PAYPAL_BUSINESS_EMAIL = "interplanetarysister@gmail.com";

export function generatePayPalLink(_campaignTitle, amount) {
  const params = new URLSearchParams({
    cmd: "_donations",
    business: IFUND_PAYPAL_BUSINESS_EMAIL,
    item_name: "Interplanetary Fund - Platform Support",
    currency_code: "USD",
  });
  if (amount) params.set("amount", String(amount));
  return `https://www.paypal.com/donate/?${params.toString()}`;
}

// Full donation block appended to cross-posted campaign content so a
// clickable PayPal link travels with the post even if copy-pasted.
export function generateDonationBlock(campaignTitle, amount, campaignId, platformOnly = false) {
  if (platformOnly) {
    const link = generatePayPalLink(campaignTitle, amount);
    return `\n\nSupport Interplanetary Fund: ${link}\nThis payment supports Interplanetary Fund development and operations, not the individual campaign shown.`;
  }
  const link = campaignId
    ? `https://interplanetaryfund.com/campaign/${encodeURIComponent(campaignId)}?donate=true`
    : "https://interplanetaryfund.com/discover";
  return `\n\n💛 Support this campaign: ${link}\nEvery donation makes a difference. Thank you! 🙏`;
}

// Short version for character-limited platforms (X, etc.).
export function generateShortDonationBlock(campaignTitle, campaignId, platformOnly = false) {
  if (platformOnly) {
    return `\nSupport Interplanetary Fund (not this campaign): ${generatePayPalLink(campaignTitle)}`;
  }
  const link = campaignId
    ? `https://interplanetaryfund.com/campaign/${encodeURIComponent(campaignId)}?donate=true`
    : "https://interplanetaryfund.com/discover";
  return `\n💛 Donate: ${link}`;
}