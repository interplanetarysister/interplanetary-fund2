# Agent Runtime Unification

## Canonical architecture

- Convex is the authoritative agent state, memory, outcomes, and operational identity layer.
- Base44 remains the user-facing application and conversational interface.
- `syncFromConvex` mirrors authoritative Convex state into Base44 display entities.
- Base44 agent conversations are bridged back to Convex through `recordAgentInteraction`.
- Existing Base44 agent names are mapped to canonical operational identities; existing records are not deleted or renamed by this change.

## Identity mapping

| Base44 agent | Canonical Convex identity |
| --- | --- |
| Chief of Staff | Solene |
| Outreach Agent | Atlas |
| Strategy Agent | Post Production Agent |
| Story Agent | Donor Relations Agent |
| Growth Agent | Scout Agent |
| Communications Agent | Platform Coordinator Agent |
| Finance Agent | Finance Agent |

## Memory flow

`User -> Base44 Agent Chat -> recordAgentInteraction -> Convex agentBridge:recordInteraction -> authoritative agent working/long-term memory`

The bridge is deliberately best-effort from the UI side: a memory-sync failure is logged but does not break the user's conversation.

## Safety

The bridge records interaction summaries and outcomes. It does not grant new permissions, execute approvals, modify payments, or bypass the existing human-approval model.
