import React from "react";
import AgentChat from "@/components/agents/AgentChat";
import { Badge } from "@/components/ui/badge";
import { Bot, ShieldCheck } from "lucide-react";

export default function BuilderAgentPanel() {
  return (
    <section className="space-y-4" aria-labelledby="builder-agent-heading">
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Bot className="h-5 w-5 text-cyan-700" />
          <h2 id="builder-agent-heading" className="font-display text-xl text-stone-900">
            Admin Builder
          </h2>
          <Badge variant="outline" className="border-cyan-300 bg-white text-cyan-800">
            Admin only
          </Badge>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          Describe a defect, regression, or configuration problem. The builder examines available
          operational evidence, proposes the smallest repair, and records work through the approved
          repair path. It never changes payments, permissions, users, or production code without an
          explicit authorized tool and confirmation.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Access is checked before a conversation starts.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <AgentChat
          agentName="builder_agent"
          agentLabel="Admin Builder"
          greeting="I’m the Admin Builder. Tell me what is broken, where you saw it, and what you expected. I’ll verify the evidence, isolate the cause, and use only the repair actions I’m authorized to perform."
          requiresAdmin
        />
      </div>
    </section>
  );
}
