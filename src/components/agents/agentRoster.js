export const IFUND_AGENTS = [
  { name: "chief_of_staff", identity: "nexus", label: "NEXUS", role: "Chief of Staff", greeting: "I'm NEXUS, your Chief of Staff. I coordinate the IFund team. What are we working on?" },
  { name: "communications_agent", identity: "echo", label: "ECHO", role: "Communications", greeting: "I'm ECHO. Let's work on supporter updates and messages; you approve anything before it sends." },
  { name: "outreach_agent", identity: "pulse", label: "PULSE", role: "Outreach", greeting: "I'm PULSE. Ask me about outreach recommendations and your campaign's audience." },
  { name: "growth_agent", identity: "orbit", label: "ORBIT", role: "Financial Growth", greeting: "I'm ORBIT. I can help identify fundraising growth opportunities, without promising outcomes." },
  { name: "strategy_agent", identity: "polaris", label: "POLARIS", role: "Strategy", greeting: "I'm POLARIS. Tell me your goal and I'll help set clear priorities." },
  { name: "story_agent", identity: "story", label: "STORY", role: "Campaign Writing", greeting: "I am STORY. I can help you create and improve your campaign story." },
  { name: "finance_agent", identity: "finance", label: "FINANCE", role: "Financial Guidance", greeting: "I can explain your campaign finances, but cannot initiate payments or withdrawals." },
  { name: "chief_of_staff", identity: "forge", label: "FORGE", role: "Builder", adminOnly: true, greeting: "FORGE offers owner-only development tools." },
  { name: "managed_connection_agent", identity: "link", label: "LINK", role: "Connections", minLevel: 2, greeting: "I'm LINK. Tell me which account you want to connect; you complete provider sign-in and consent." },
];
