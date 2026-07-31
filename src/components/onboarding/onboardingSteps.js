// Modular, pluggable configuration for the Crowdfund onboarding experience.
// Add new capability modules, AI agents, or integrations here without redesigning the UI.

export const ENGINE_CAPABILITIES = [
  {
    id: "discovery",
    icon: "Compass",
    title: "Donor Discovery",
    description: "Identifies likely supporters across your connected platforms and recommends outreach.",
  },
  {
    id: "optimization",
    icon: "Sparkles",
    title: "Campaign Optimization",
    description: "Continuously reviews your campaigns and suggests improvements to story, goal, and timing.",
  },
  {
    id: "automation",
    icon: "Zap",
    title: "Fundraising Automation",
    description: "Automates cross-platform publishing and synchronized campaign updates where supported.",
  },
  {
    id: "support",
    icon: "LifeBuoy",
    title: "Ongoing Support",
    description: "Mission Control monitors every campaign and alerts you to risks and opportunities.",
  },
];

// Capability modules are intentionally pluggable: each entry renders a card in the
// Connect step. New fundraising platforms, payment providers, or social channels
// can be appended here without touching the component code.
export const CAPABILITY_MODULES = [
  {
    id: "external_fundraising",
    group: "Fundraising Platforms",
    items: [
      { id: "gofundme", label: "GoFundMe", status: "coming_soon" },
      { id: "kickstarter", label: "Kickstarter", status: "coming_soon" },
      { id: "indiegogo", label: "Indiegogo", status: "coming_soon" },
    ],
  },
  {
    id: "social",
    group: "Social Media & Channels",
    items: [
      { id: "facebook_pages", label: "Facebook Pages", status: "available" },
      { id: "instagram", label: "Instagram Business", status: "available" },
      { id: "tiktok", label: "TikTok", status: "available" },
      { id: "linkedin", label: "LinkedIn", status: "available" },
    ],
  },
  {
    id: "payments",
    group: "Payment Providers",
    items: [
      { id: "stripe", label: "Stripe", status: "connected" },
      { id: "paypal", label: "PayPal", status: "coming_soon" },
    ],
  },
];

export const FUNDRAISING_GOALS = [
  { id: "nonprofit", label: "Nonprofit / Charity" },
  { id: "personal", label: "Personal Cause" },
  { id: "community", label: "Community Project" },
  { id: "creative", label: "Creative Project" },
  { id: "business", label: "Social Enterprise" },
  { id: "other", label: "Other" },
];