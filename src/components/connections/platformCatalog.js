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
      { id: "totals", label: "Enter your current totals",      hint: "Enter the amount shown on your fundraiser. We’ll keep it updated when we can." },
      { id: "link",   label: "Link to a campaign (optional)",  hint: "Pick which Interplanetary Fund campaign these figures should roll up into." },
    ],
    api: "Link your fundraiser and keep its total here.",
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
      { id: "totals", label: "Enter your current totals",          hint: "Enter the amount shown on your project. We’ll update it automatically when possible." },
      { id: "link",   label: "Link to a campaign (optional)",      hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "Link your project and keep its progress here.",
  },
  {
    id: "indiegogo",
    name: "Indiegogo",
    kind: "crowdfunding",
    color: "#eb1478",
    icon: "🎯",
    tagline: "Link your Indiegogo campaign and keep its progress here.",
    setupKind: "link",
    steps: [
      { id: "url",    label: "Paste your Indiegogo campaign URL", hint: "Copy the URL from your Indiegogo campaign page." },
      { id: "totals", label: "Enter your current totals",         hint: "Enter the amount shown on your campaign. We’ll update it automatically when possible." },
      { id: "link",   label: "Link to a campaign (optional)",     hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "Link your campaign now. We’ll use the best available way to keep it updated.",
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
      { id: "totals", label: "Enter your current totals",        hint: "Enter the amount shown on your campaign. We’ll update it automatically when possible." },
      { id: "link",   label: "Link to a campaign (optional)",    hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "Link your campaign now. We’ll use the best available way to keep it updated.",
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
      { id: "totals", label: "Enter your current totals", hint: "Enter the amount shown on your fundraiser." },
      { id: "link",   label: "Link to a campaign (optional)", hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "Link your fundraiser and keep its total here.",
  },
  {
    id: "kofi",
    name: "Ko-fi",
    kind: "crowdfunding",
    color: "#ff5e5b",
    icon: "☕",
    tagline: "Connect Ko-fi so new support can appear here automatically.",
    setupKind: "token",
    steps: [
      { id: "token",  label: "Enter your Ko-fi connection code", hint: "In Ko-fi settings, copy the connection code shown for outside apps." },
      { id: "webhook",label: "Finish Ko-fi setup",          hint: null }, // hint injected dynamically with the actual URL
      { id: "link",   label: "Link to a campaign (optional)",       hint: "Ko-fi donations will count toward this campaign's total." },
    ],
    api: "Follow the short setup steps to keep Ko-fi support updated automatically.",
  },
  {
    id: "buymeacoffee",
    name: "Buy Me a Coffee",
    kind: "crowdfunding",
    color: "#ffdd00",
    icon: "☕",
    tagline: "Connect Buy Me a Coffee so support can update here automatically.",
    setupKind: "token",
    steps: [
      { id: "token",  label: "Enter your connection code", hint: "Find the connection code in your Buy Me a Coffee settings." },
      { id: "link",   label: "Link to a campaign (optional)", hint: "Donations will roll up into this campaign." },
    ],
    api: "Connect your account to keep support updated automatically.",
  },
  {
    id: "patreon",
    name: "Patreon",
    kind: "crowdfunding",
    color: "#ff424d",
    icon: "🎨",
    tagline: "Connect Patreon to keep your supporter totals together.",
    setupKind: "oauth",
    steps: [
      { id: "oauth",  label: "Sign in with Patreon", hint: "Patreon will ask you to sign in and approve the connection. We never see your password." },
      { id: "link",   label: "Link to a campaign (optional)", hint: "Pledge totals will roll up into this campaign." },
    ],
    api: "Sign in to Patreon and approve the connection.",
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
      { id: "totals", label: "Enter your current totals",        hint: "Enter the amount shown on your fundraiser." },
      { id: "link",   label: "Link to a campaign (optional)",    hint: "Connect these figures to one of your IF campaigns." },
    ],
    api: "Link your fundraiser and keep its total here.",
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
      { id: "totals", label: "Enter your current totals", hint: "Enter the amount shown on the fundraiser." },
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
    tagline: "Connect Bluesky to share campaign updates.",
    setupKind: "multi",
    steps: [
      { id: "handle",   label: "Enter your Bluesky handle", hint: "e.g. you.bsky.social" },
      { id: "password", label: "Get a Bluesky connection password", hint: "In Bluesky settings, create an App Password for Interplanetary Fund. Never use your main password." },
      { id: "auto",     label: "Choose how much help you want",   hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect Bluesky to share updates from Interplanetary Fund.",
  },
  {
    id: "mastodon",
    name: "Mastodon",
    kind: "social",
    color: "#6364ff",
    icon: "🐘",
    tagline: "Connect Mastodon to share campaign updates.",
    setupKind: "multi",
    steps: [
      { id: "instance", label: "Enter your Mastodon site",    hint: "For example: mastodon.social" },
      { id: "token",    label: "Get a Mastodon connection code",  hint: "In your Mastodon settings, create a connection for Interplanetary Fund and copy the code it gives you." },
      { id: "auto",     label: "Choose how much help you want",         hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect Mastodon to share updates from Interplanetary Fund.",
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
      { id: "oauth", label: "Sign in with Facebook", hint: "Facebook will ask you to sign in and approve the connection. We never see your password." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with Instagram", hint: "Instagram will ask you to sign in and approve the connection. We never see your password." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with Threads", hint: "Threads will ask you to sign in and approve the connection." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with X", hint: "X will ask you to sign in and approve the connection. We never see your password." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with LinkedIn", hint: "LinkedIn will ask you to sign in and approve the connection. We never see your password." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with TikTok", hint: "TikTok will ask you to sign in and approve the connection. We never see your password." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with Pinterest", hint: "Pinterest will ask you to sign in and approve the connection." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with Reddit", hint: "Reddit will ask you to sign in and approve the connection." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with Google / YouTube", hint: "Google will ask you to sign in and approve the YouTube connection." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
      { id: "oauth", label: "Sign in with Discord", hint: "Discord will ask you to sign in and approve the connection. We never see your password." },
      { id: "auto",  label: "Choose how much help you want", hint: "Choose whether Interplanetary Fund may share for you, ask first, make drafts, or do nothing." },
    ],
    api: "Connect your account to share updates where available.",
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
