import { PUBLIC_IFUND_ORIGIN } from "./campaignSharing.js";

// These are user-initiated share composers, not background publishing APIs.
// Services without a universal web compose link remain available through the
// device's native share sheet when their apps support receiving a shared URL.
function composeUrl(base, params) {
  const link = new URL(base);
  Object.entries(params).forEach(([key, value]) => link.searchParams.set(key, value));
  return link.href;
}

export function buildSocialShareTargets({ url, title, image } = {}) {
  let campaignUrl;
  try {
    campaignUrl = new URL(url);
  } catch {
    return [];
  }
  if (campaignUrl.origin !== PUBLIC_IFUND_ORIGIN
    || !/^\/campaign\/[A-Za-z0-9_-]{1,128}$/.test(campaignUrl.pathname)
    || campaignUrl.search || campaignUrl.hash) return [];

  const canonical = campaignUrl.href;
  const name = String(title || "A campaign").trim().slice(0, 180) || "A campaign";
  const blurb = `Explore "${name}" on Interplanetary Fund.`;
  const combined = `${blurb} ${canonical}`;
  const targets = [
    { id: "facebook", name: "Facebook", href: composeUrl("https://www.facebook.com/sharer/sharer.php", { u: canonical }) },
    { id: "x", name: "X", href: composeUrl("https://twitter.com/intent/tweet", { text: blurb, url: canonical }) },
    { id: "linkedin", name: "LinkedIn", href: composeUrl("https://www.linkedin.com/sharing/share-offsite/", { url: canonical }) },
    { id: "reddit", name: "Reddit", href: composeUrl("https://www.reddit.com/submit", { url: canonical, title: blurb }) },
    { id: "whatsapp", name: "WhatsApp", href: composeUrl("https://api.whatsapp.com/send", { text: combined }) },
    { id: "telegram", name: "Telegram", href: composeUrl("https://t.me/share/url", { url: canonical, text: blurb }) },
    { id: "bluesky", name: "Bluesky", href: composeUrl("https://bsky.app/intent/compose", { text: combined }) },
    { id: "tumblr", name: "Tumblr", href: composeUrl("https://www.tumblr.com/widgets/share/tool", { canonicalUrl: canonical, title: name, caption: blurb }) },
    { id: "email", name: "Email", href: `mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(combined)}`, external: false },
    { id: "sms", name: "Text message", href: `sms:?body=${encodeURIComponent(combined)}`, external: false },
  ];
  try {
    const picture = new URL(image);
    if (picture.protocol === "https:" && !picture.username && !picture.password) {
      targets.splice(4, 0, { id: "pinterest", name: "Pinterest",
        href: composeUrl("https://www.pinterest.com/pin/create/button/", {
          url: canonical, media: picture.href, description: blurb,
        }) });
    }
  } catch { /* No public HTTPS image: omit Pinterest's image-required composer. */ }
  return targets;
}
