import React, { useEffect, useState } from "react";
import AgentMonitor from "@/components/agents/AgentMonitor";
import { base44 } from "@/api/base44Client";
import { getFrontendIdentity } from "@/lib/adminBootstrap";
import { hasPlanLevel } from "@/lib/subscriptionEntitlements";
import { Link } from "react-router-dom";

// Always-on AI agent team. The Chief of Staff coordinates; each specialist
// handles one domain. Switching agents starts a fresh conversation.
const AGENTS = [
  { name: "chief_of_staff", identity: "nexus", label: "NEXUS", role: "Chief of Staff", greeting: "I'm NEXUS, your Chief of Staff. I coordinate the IFund team. What are we working on?" },
  { name: "communications_agent", identity: "echo", label: "ECHO", role: "Communications", greeting: "I'm ECHO. Let's work on supporter updates and messages; you approve anything before it sends." },
  { name: "outreach_agent", identity: "pulse", label: "PULSE", role: "Outreach", greeting: "I'm PULSE. Ask me about outreach recommendations and your campaign's audience." },
  { name: "growth_agent", identity: "orbit", label: "ORBIT", role: "Financial Growth", greeting: "I'm ORBIT. I can help identify fundraising growth opportunities, without promising outcomes." },
  { name: "strategy_agent", identity: "polaris", label: "POLARIS", role: "Strategy", greeting: "I'm POLARIS. Tell me your goal and I'll help set clear priorities." },
  { name: "chief_of_staff", identity: "forge", label: "FORGE", role: "Builder", adminOnly: true, greeting: "FORGE offers owner-only development tools." },
  { name: "managed_connection_agent", identity: "link", label: "LINK", role: "Connections", minLevel: 2, greeting: "I'm LINK. Tell me which account you want to connect; you complete provider sign-in and consent." },
];

export default function Agents() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null)).finally(() => setLoadingUser(false));
  }, []);

  if (loadingUser) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-muted-foreground">Loading your AI team…</div>;
  if (!hasPlanLevel(user, 1)) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
    <h1 className="font-display text-3xl text-foreground">Your AI team</h1>
    <p className="text-muted-foreground">An agent monitor, updates, and personal campaign conversations are available with an eligible AI subscription.</p>
    <div className="rounded-2xl bg-card border border-border p-5">
      <h2 className="font-semibold text-foreground text-lg">Enable your AI team</h2>
      <p className="text-sm text-muted-foreground mt-2">You can still create campaigns and participate in the community with a free account.</p>
      <Link to="/subscriptions" className="inline-flex mt-4 min-h-11 items-center rounded-xl bg-blue-700 px-4 text-white text-sm font-semibold hover:bg-blue-800">Explore AI subscriptions</Link>
    </div>
  </div>;

  const canUseAdminTools = getFrontendIdentity(user).superAdminOwner;
  const visibleAgents = AGENTS.filter((agent) => (!agent.minLevel || hasPlanLevel(user, agent.minLevel)) && (!agent.adminOnly || canUseAdminTools));
  return <AgentMonitor user={user} agents={visibleAgents} canUseAdminTools={canUseAdminTools} />;
}
