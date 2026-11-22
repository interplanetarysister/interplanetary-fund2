import React from "react";
import { Link } from "react-router-dom";
import AgentMonitor from "@/components/agents/AgentMonitor";
import { IFUND_AGENTS } from "@/components/agents/agentRoster";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getFrontendIdentity } from "@/lib/adminBootstrap";
import { hasPlanLevel } from "@/lib/subscriptionEntitlements";

export default function AgentTeamDrawer({ user, open, onOpenChange }) {
  if (!user?.id) return null;

  if (!hasPlanLevel(user, 1)) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex h-[100dvh] w-full max-w-full flex-col overflow-y-auto pt-12 sm:w-[min(95vw,28rem)] sm:max-w-[28rem]">
          <SheetHeader className="text-left">
            <SheetTitle>Your AI Team</SheetTitle>
            <SheetDescription>An agent monitor, updates, and personal campaign conversations are available with an eligible AI subscription.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">Enable your AI team</h2>
            <p className="mt-2 text-sm text-muted-foreground">You can still create campaigns and participate in the community with a free account.</p>
            <Link to="/subscriptions" onClick={() => onOpenChange(false)} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800">Explore AI subscriptions</Link>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const canUseAdminTools = getFrontendIdentity(user).superAdminOwner;
  const agents = IFUND_AGENTS.filter((agent) =>
    (!agent.minLevel || hasPlanLevel(user, agent.minLevel)) &&
    (!agent.adminOnly || canUseAdminTools)
  );

  return (
    <AgentMonitor
      user={user}
      agents={agents}
      canUseAdminTools={canUseAdminTools}
      drawerMode
      teamOpen={open}
      onTeamOpenChange={onOpenChange}
    />
  );
}
