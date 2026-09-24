# Agent Runtime and Memory Architecture

## Canonical architecture

- Base44 is the authoritative application, agent runtime, and user-facing conversational environment for Interplanetary Fund.
- Base44 native agent memory is the authoritative memory mechanism for the in-app agent team.
- GitHub main contains the authoritative application configuration synchronized with the Base44 app.
- Do not introduce Convex or Vercel as a second agent-memory runtime for ifund2.

## Agent memory configuration

Every normal user-facing specialist agent must have:

- `memory_config.enabled: true`
- `memory_config.scope: "both"`
- `memory_config.include_other_conversation_context: true`

This allows each specialist to retain its own useful context while also receiving relevant context from the user's other conversations. Chief of Staff uses the same capability for cross-agent coordination.

Memory instructions must preserve these boundaries:

- User/campaign-specific facts remain scoped to that user and campaign.
- Generalized learning must not silently convert private user information into shared training.
- Current verified campaign data overrides remembered patterns.
- New explicit user instructions override conflicting remembered preferences.
- Memory never expands permissions, approval scope, financial authority, or external-platform authorization.
- Secrets and credentials must never be stored as agent memory.

## Conversation flow

`User -> Base44 Agent Chat -> Base44 conversation -> native Base44 agent memory -> relevant future agent conversations`

The chat UI may create a new conversation session when the selected specialist changes. Continuity comes from the configured Base44 memory system rather than a separate Convex interaction-summary bridge.

## Cross-agent continuity

All seven user-facing agents have cross-conversation context enabled. Specialists may use relevant context from other agent conversations, but should remain focused on their own role. Chief of Staff has the broadest coordination responsibility and should use available cross-agent context to avoid making the user repeat known instructions or decisions.

Structured delegation/task tracking remains separate from conversational memory. `AgentDelegation` is the authoritative Base44 record for substantive cross-agent assignments, including source/destination agent, objective, campaign context, real status, result, and verification. Chief of Staff can create/read/update these records. Conversation memory preserves context; delegation records preserve operational state.

## Campaign context isolation

Cross-conversation memory does not make campaign context interchangeable. Campaign-specific facts, drafts, outcomes, beneficiary details, financial information, and instructions must remain anchored to the applicable campaign ID. A campaign title may be retained for readability, but the campaign ID is authoritative.

Before a consequential campaign-specific action, agents should use the current selected/delegated campaign context and current authoritative records. If remembered context belongs to another campaign, it must not be imported into the active campaign. General user-level preferences may carry across campaigns only when they are genuinely user-level.

Structured `AgentDelegation` records therefore preserve `campaign_id` separately from their context summary. When no campaign applies, the field may remain empty rather than guessing.

## Correction and supersession

Memory is not append-only truth. Within the same scope, a newer explicit user correction supersedes an older user-provided fact or preference, and current authoritative platform state supersedes remembered operational state. Repetition of stale information does not make it current.

Corrections must preserve scope: correcting one campaign does not silently change another campaign, and correcting a campaign-specific instruction does not automatically rewrite a user-level preference.

Structured delegated work uses explicit supersession. If a correction still describes the same assignment, update that assignment. If it replaces the assignment, mark the old `AgentDelegation` as `superseded` and link old/new records with the supersession fields. Completed or superseded historical records may remain for accountability but must not be treated as active instructions.

## Safety

Memory does not:

- grant new permissions;
- approve external actions;
- authorize payments or withdrawals;
- bypass ownership or admin boundaries;
- prove that a requested action was executed.

Remembered claims about external or financial actions must be checked against authoritative current records when those facts matter.

## Verification target

Memory is considered correctly configured when:

1. All seven user-facing agents have memory enabled.
2. Cross-conversation context is enabled for all seven.
3. Chief of Staff can use relevant context from specialist conversations.
4. Switching agents does not require a Convex/Vercel memory bridge.
5. User-specific memory remains separate from generalized training.
6. Current authoritative data and permissions override remembered information.

