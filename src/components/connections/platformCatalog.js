// The Universal Connections catalog — every fundraising and social destination
// Interplanetary Fund can link to.
//
// Each entry carries:
//   id           — stable platform key used in PlatformConnection records
//   name         — display name
//   kind         — "crowdfunding" | "social"
//   color        — brand accent for the plugin card background/icon
//   icon         — emoji or short symbol shown on the card
//   tagline      — one line: what connecting gives you
//   setupKind    — "link"    → paste a URL + optional totals (no credentials)
//                  "token"   → paste one secret (webhook token, app password…)
//                  "oauth"   → provider OAuth flow (button, no manual paste)
//                  "multi"   → two or more credential fields
//   steps        — ordered array of step descriptors used by the connect wizard
//   api          — legacy one-liner kept for backward compatibility

export const CROWDFUNDING_PLATFORMS = [
  {
    id: "gofundme",
    name: "GoFundMe",
    kind: "crowdfunding",
    color: "#00b964",
    icon: "💚",
    tagline: "Link your GoFundMe and track totals alongside your IF campaign.",
    setupKind: "link",
    steps: [
      { id: "url",    label: "Paste your GoFundMe URL",        hint: "Open your GoFundMe campaign and copy the link from the address bar." },
      { id: "totals", label: "Enter your current totals",      hint: "These are owner-reported for now. We'll verify them when a read API becomes available." },
      { id: "link",   label: "Link to a campaign (optional)",  hint: "Pick which Interplanetary Fund campaign these figures should roll up into." },
    ],
    api: "No public API — link your campaign; totals sync is owner-reported.",
  },
  {
    id: "kickstarter",
    name: "Kickstarter",
    kind: "crowdfunding",
    color: "#05ce78",
    icon: "🚀",
    tagline: "Connect your Kickstarter project and track backer totals here.",
    setupKind: "link",
    steps: [
      { id: "url",    label: "Paste your Kickstarter project URL", hint: "Copy the link from your Kickstarter project page." },
      { id: "totals", label: "Enter your current totals",          hint: "Owner-reported totals — updated manually or when Kickstarter opens its API." },
      { id: "link",   label: "Link to a campaign (optional)",      hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "No public write API — link your project; totals sync is owner-reported.",
  },
  {
    id: "indiegogo",
    name: "Indiegogo",
    kind: "crowdfunding",
    color: "#eb1478",
    icon: "🎯",
    tagline: "Link your Indiegogo campaign — live sync activates when partner API is approved.",
    setupKind: "link",
    steps: [
      { id: "url",    label: "Paste your Indiegogo campaign URL", hint: "Copy the URL from your Indiegogo campaign page." },
      { id: "totals", label: "Enter your current totals",         hint: "We'll upgrade to live sync once the Indiegogo partner API is available." },
      { id: "link",   label: "Link to a campaign (optional)",     hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "Partner API requires approval — link now, live sync activates when approved.",
  },
  {
    id: "fundrazr",
    name: "FundRazr",
    kind: "crowdfunding",
    color: "#0066cc",
    icon: "💙",
    tagline: "Track your FundRazr campaign totals alongside your IF dashboard.",
    setupKind: "link",
    steps: [
      { id: "url",    label: "Paste your FundRazr campaign URL", hint: "Copy the URL from your FundRazr campaign." },
      { id: "totals", label: "Enter your current totals",        hint: "We'll upgrade to live sync when the FundRazr API is available." },
      { id: "link",   label: "Link to a campaign (optional)",    hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "API access requires approval — link now, live sync activates when approved.",
  },
  {
    id: "givesendgo",
    name: "GiveSendGo",
    kind: "crowdfunding",
    color: "#3b82f6",
    icon: "🙏",
    tagline: "Link your GiveSendGo campaign and keep your total in one place.",
    setupKind: "link",
    steps: [
      { id: "url",    label: "Paste your GiveSendGo URL", hint: "Copy the link from your GiveSendGo campaign page." },
      { id: "totals", label: "Enter your current totals", hint: "Owner-reported — updated manually." },
      { id: "link",   label: "Link to a campaign (optional)", hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "No public API — link your campaign; totals sync is owner-reported.",
  },
  {
    id: "kofi",
    name: "Ko-fi",
    kind: "crowdfunding",
    color: "#ff5e5b",
    icon: "☕",
    tagline: "Live donation sync via webhook — every Ko-fi donation appears instantly.",
    setupKind: "token",
    steps: [
      { id: "token",  label: "Paste your Ko-fi verification token", hint: "In Ko-fi → Settings → API → copy your Verification Token." },
      { id: "webhook",label: "Set your Ko-fi webhook URL",          hint: null }, // hint injected dynamically with the actual URL
      { id: "link",   label: "Link to a campaign (optional)",       hint: "Ko-fi donations will count toward this campaign's total." },
    ],
    api: "Live donation sync — paste your Ko-fi verification token and set the webhook URL shown when connecting.",
  },
  {
    id: "buymeacoffee",
    name: "Buy Me a Coffee",
    kind: "crowdfunding",
    color: "#ffdd00",
    icon: "☕",
    tagline: "Connect your Buy Me a Coffee with your access token for live sync.",
    setupKind: "token",
    steps: [
      { id: "token",  label: "Paste your access token", hint: "From Buy Me a Coffee → Settings → Extras → API." },
      { id: "link",   label: "Link to a campaign (optional)", hint: "Donations will roll up into this campaign." },
    ],
    api: "API supported — live sync activates with your access token.",
  },
  {
    id: "patreon",
    name: "Patreon",
    kind: "crowdfunding",
    color: "#ff424d",
    icon: "🎨",
    tagline: "OAuth-connected Patreon sync — live pledge data when approved.",
    setupKind: "oauth",
    steps: [
      { id: "oauth",  label: "Sign in with Patreon", hint: "You'll be sent to Patreon to authorize. We never see your password." },
      { id: "link",   label: "Link to a campaign (optional)", hint: "Pledge totals will roll up into this campaign." },
    ],
    api: "OAuth API supported — live sync activates when OAuth credentials are approved.",
  },
  {
    id: "spotfund",
    name: "Spotfund",
    kind: "crowdfunding",
    color: "#8b5cf6",
    icon: "🌟",
    tagline: "Link your Spotfund campaign and track its progress here.",
    setupKind: "link",
    steps: [
      { id: "url",    label: "Paste your Spotfund campaign URL", hint: "Copy the URL from your Spotfund campaign." },
      { id: "totals", label: "Enter your current totals",        hint: "Owner-reported — updated manually." },
      { id: "link",   label: "Link to a campaign (optional)",    hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "No public API — link your campaign; totals sync is owner-reported.",
  },
  {
    id: "custom",
    name: "Custom Campaign URL",
    kind: "crowdfunding",
    color: "#64748b",
    icon: "🔗",
    tagline: "Link any external campaign page and track its totals here.",
    setupKind: "link",
    steps: [
      { id: "name",   label: "Name this connection",      hint: "e.g. 'Our fundraiser on Example Site'" },
      { id: "url",    label: "Paste the campaign URL",    hint: "Any external fundraising page." },
      { id: "totals", label: "Enter your current totals", hint: "Owner-reported — you update these manually." },
      { id: "link",   label: "Link to a campaign (optional)", hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "Link any external campaign page and track its totals here.",
  },
];

export const SOCIAL_PLATFORMS = [
  {
    id: "bluesky",
    name: "Bluesky",
    kind: "social",
    color: "#0085ff",
    icon: "🦋",
    tagline: "Publish campaign updates directly to Bluesky with your app password.",
    setupKind: "multi",
    steps: [
      { id: "handle",   label: "Enter your Bluesky handle", hint: "e.g. you.bsky.social" },
      { id: "password", label: "Create a Bluesky app password", hint: "In Bluesky → Settings → App Passwords → New app password. Never your main password." },
      { id: "auto",     label: "Set AI automation level",   hint: "Choose how much the AI does automatically." },
    ],
    api: "Direct publishing supported — connect with your handle and an app password.",
  },
  {
    id: "mastodon",
    name: "Mastodon",
    kind: "social",
    color: "#6364ff",
    icon: "🐘",
    tagline: "Post campaign updates to any Mastodon instance with your access token.",
    setupKind: "multi",
    steps: [
      { id: "instance", label: "Enter your Mastodon instance",    hint: "e.g. mastodon.social or your own server." },
      { id: "token",    label: "Create a Mastodon access token",  hint: "In your instance → Preferences → Development → New Application → copy the access token." },
      { id: "auto",     label: "Set AI automation level",         hint: "Choose how much the AI does automatically." },
    ],
    api: "Direct publishing supported — connect with your instance and an access token.",
  },
  {
    id: "facebook",
    name: "Facebook",
    kind: "social",
    color: "#1877f2",
    icon: "👍",
    tagline: "Sign in with Facebook to publish campaign updates to your page.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with Facebook", hint: "You'll be taken to Facebook to authorize. We never see your password." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "instagram",
    name: "Instagram",
    kind: "social",
    color: "#e1306c",
    icon: "📸",
    tagline: "Sign in with Instagram to share campaign updates and stories.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with Instagram", hint: "You'll be taken to Instagram to authorize. We never see your password." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "threads",
    name: "Threads",
    kind: "social",
    color: "#101010",
    icon: "🧵",
    tagline: "Share campaign updates on Threads via your Instagram account.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with Threads", hint: "Uses your Instagram login. You'll authorize on Meta's site." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "x",
    name: "X (Twitter)",
    kind: "social",
    color: "#000000",
    icon: "𝕏",
    tagline: "Post campaign updates to X — reach your followers with every update.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with X", hint: "You'll be taken to X to authorize. We never see your password." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    kind: "social",
    color: "#0a66c2",
    icon: "💼",
    tagline: "Share campaign updates on LinkedIn to reach professional networks.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with LinkedIn", hint: "You'll be taken to LinkedIn to authorize. We never see your password." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    kind: "social",
    color: "#010101",
    icon: "🎵",
    tagline: "Sign in with TikTok to post campaign content to your audience.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with TikTok", hint: "You'll be taken to TikTok to authorize. We never see your password." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    kind: "social",
    color: "#e60023",
    icon: "📌",
    tagline: "Pin campaign updates to your Pinterest boards.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with Pinterest", hint: "You'll be taken to Pinterest to authorize." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "reddit",
    name: "Reddit",
    kind: "social",
    color: "#ff4500",
    icon: "👽",
    tagline: "Share campaign posts to relevant subreddits.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with Reddit", hint: "You'll be taken to Reddit to authorize." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "youtube",
    name: "YouTube",
    kind: "social",
    color: "#ff0000",
    icon: "▶️",
    tagline: "Post campaign updates to your YouTube Community tab.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with Google / YouTube", hint: "You'll be taken to Google to authorize your YouTube account." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
  {
    id: "discord",
    name: "Discord",
    kind: "social",
    color: "#5865f2",
    icon: "🎮",
    tagline: "Sign in with Discord to announce campaign updates in your server.",
    setupKind: "oauth",
    steps: [
      { id: "oauth", label: "Sign in with Discord", hint: "You'll be taken to Discord to authorize. We never see your password." },
      { id: "auto",  label: "Set AI automation level", hint: "Choose how much the AI does automatically." },
    ],
    api: "OAuth posting pending platform approval.",
  },
];

export const ALL_PLATFORMS = [...CROWDFUNDING_PLATFORMS, ...SOCIAL_PLATFORMS];
export const platformName = (id) => ALL_PLATFORMS.find((p) => p.id === id)?.name || id;
export const platformById = (id) => ALL_PLATFORMS.find((p) => p.id === id) || null;

export const AUTOMATION_MODES = [
  { value: "auto",   label: "Publish automatically",  desc: "AI publishes approved content without asking." },
  { value: "ask",    label: "Ask before every post",  desc: "AI prepares content and waits for your approval." },
  { value: "draft",  label: "Generate drafts only",   desc: "AI writes drafts; you publish them yourself." },
  { value: "manual", label: "Manual posting only",    desc: "AI never touches this destination." },
];
