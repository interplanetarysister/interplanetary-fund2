import React, { useEffect, useState } from "react";
import AgentChat from "@/components/agents/AgentChat";
import AdminDevelopmentChat from "@/components/agents/AdminDevelopmentChat";
import { base44 } from "@/api/base44Client";
import { getFrontendIdentity } from "@/lib/adminBootstrap";
import { Sparkles, TrendingUp, MessageSquare, PenLine, Wallet, Megaphone, Crown } from "lucide-react";
import { hasPlanLevel } from "@/lib/subscriptionEntitlements";
import { Navigate } from "react-router-dom";

// Always-on AI agent team. The Chief of Staff coordinates; each specialist
// handles one domain. Switching agents starts a fresh conversation.
const AGENTS = [
  { name: "chief_of_staff", label: "Chief of Staff", icon: Crown, greeting: "I'm your Chief of Staff — always on. I coordinate your full AI team and can pull up any campaign's status, finances, and outreach. What would you like to work on?" },
  { name: "strategy_agent", label: "Strategy", icon: Sparkles, greeting: "I'm your Strategy Agent. Tell me which campaign you're focused on and I'll help you decide where to push for the greatest impact." },
  { name: "growth_agent", label: "Growth", icon: TrendingUp, greeting: "I'm your Growth Agent. I analyze donations and your connected platforms to find new supporter opportunities." },
  { name: "communications_agent", label: "Communications", icon: MessageSquare, greeting: "I'm your Communications Agent. I'll draft updates and thank-you messages for your supporters — you approve everything before it sends." },
  { name: "story_agent", label: "Story", icon: PenLine, greeting: "I'm your Story Agent. Share your campaign and I'll help you tell its story authentically." },
  { name: "finance_agent", label: "Finance", icon: Wallet, greeting: "I'm your Finance Agent. Ask me about raised amounts, clearing funds, fees, or payouts for any of your campaigns." },
  { name: "outreach_agent", label: "Outreach", icon: Megaphone, greeting: "I'm your Outreach Agent. I'll surface open recommendations and the autonomous agent's activity for your opted-in campaigns." },
];

export default function Agents() {
  const [active, setActive] = useState(AGENTS[0]);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null)).finally(() => setLoadingUser(false));
  }, []);

  if (loadingUser) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 text-muted-foreground">Loading AI Agents…</div>;
  if (!hasPlanLevel(user, 1)) return <Navigate to="/subscriptions" replace />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl text-foreground mb-1">Your AI team</h1>
      <p className="text-muted-foreground mb-6">Always-on agents that work alongside you. Pick one to start a conversation.</p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1 scrollbar-hide">
        {AGENTS.map((a) => {
          const Icon = a.icon;
          const on = active.name === a.name;
          return (
            <button
              key={a.name}
              onClick={() => setActive(a)}
              className={`shrink-0 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                on
                  ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
              }`}
            >
              <Icon className="w-4 h-4" /> {a.label}
            </button>
          );
        })}
      </div>

      {active.name === "chief_of_staff" && getFrontendIdentity(user).superAdminOwner && <div className="mb-4"><AdminDevelopmentChat user={user} /></div>}

      <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
        <AgentChat key={active.name} agentName={active.name} agentLabel={active.label} greeting={active.greeting} />
      </div>
    </div>
  );
}