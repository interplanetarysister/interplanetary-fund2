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

// Capability modules describe readiness prerequisites. Actual connected state
// is resolved from the user's authoritative PlatformConnection records in ConnectStep.
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
      { id: "facebook_pages", label: "Facebook Pages", status: "setup_required" },
      { id: "instagram", label: "Instagram Business", status: "setup_required" },
      { id: "tiktok", label: "TikTok", status: "setup_required" },
      { id: "linkedin", label: "LinkedIn", status: "setup_required" },
    ],
  },
  {
    id: "payments",
    group: "Payment Providers",
    items: [
      { id: "stripe", label: "Stripe", status: "setup_required" },
      { id: "paypal", label: "PayPal", status: "setup_required" },
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
