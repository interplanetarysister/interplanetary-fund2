// The Universal Connections catalog — every fundraising and social destination
// Interplanetary Fund can link to, with an honest note on what each platform's
// public API allows today. Where publishing APIs require partner approval, the
// connection framework (status, permissions, sync, automation) is fully built
// and activates as soon as credentials are available.
export const CROWDFUNDING_PLATFORMS = [
  { id: "gofundme", name: "GoFundMe", api: "No public API — link your campaign; totals sync is owner-reported." },
  { id: "kickstarter", name: "Kickstarter", api: "No public write API — link your project; totals sync is owner-reported." },
  { id: "indiegogo", name: "Indiegogo", api: "Partner API requires approval — link now, live sync activates when approved." },
  { id: "fundrazr", name: "FundRazr", api: "API access requires approval — link now, live sync activates when approved." },
  { id: "givesendgo", name: "GiveSendGo", api: "No public API — link your campaign; totals sync is owner-reported." },
  { id: "spotfund", name: "Spotfund", api: "No public API — link your campaign; totals sync is owner-reported." },
  { id: "kofi", name: "Ko-fi", api: "Live donation sync — paste your Ko-fi verification token and set the webhook URL shown when connecting." },
  { id: "buymeacoffee", name: "Buy Me a Coffee", api: "API supported — live sync activates with your access token." },
  { id: "patreon", name: "Patreon", api: "OAuth API supported — live sync activates when OAuth credentials are approved." },
  { id: "custom", name: "Custom Campaign URL", api: "Link any external campaign page and track its totals here." },
];

export const SOCIAL_PLATFORMS = [
  { id: "facebook", name: "Facebook", api: "OAuth posting pending platform approval." },
  { id: "instagram", name: "Instagram", api: "OAuth posting pending platform approval." },
  { id: "threads", name: "Threads", api: "OAuth posting pending platform approval." },
  { id: "x", name: "X", api: "OAuth posting pending platform approval." },
  { id: "linkedin", name: "LinkedIn", api: "OAuth posting pending platform approval." },
  { id: "tiktok", name: "TikTok", api: "OAuth posting pending platform approval." },
  { id: "pinterest", name: "Pinterest", api: "OAuth posting pending platform approval." },
  { id: "reddit", name: "Reddit", api: "OAuth posting pending platform approval." },
  { id: "youtube", name: "YouTube Community", api: "OAuth posting pending platform approval." },
  { id: "discord", name: "Discord", api: "OAuth posting pending platform approval." },
  { id: "bluesky", name: "Bluesky", api: "Direct publishing supported — connect with your handle and an app password." },
  { id: "mastodon", name: "Mastodon", api: "Direct publishing supported — connect with your instance and an access token." },
];

export const ALL_PLATFORMS = [...CROWDFUNDING_PLATFORMS, ...SOCIAL_PLATFORMS];
export const platformName = (id) => ALL_PLATFORMS.find((p) => p.id === id)?.name || id;

export const AUTOMATION_MODES = [
  { value: "auto", label: "Publish automatically", desc: "AI publishes approved content without asking." },
  { value: "ask", label: "Ask before every post", desc: "AI prepares content and waits for your approval." },
  { value: "draft", label: "Generate drafts only", desc: "AI writes drafts; you publish them yourself." },
  { value: "manual", label: "Manual posting only", desc: "AI never touches this destination." },
];