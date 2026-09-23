# Shared OBO Agent Capability Contract

This contract captures the immediate implementation requirements for connected platforms and the in-app agent team.

## Connection experience
- A platform is connected once per user, not once per agent.
- The platform picker shows connection health with a small green indicator for a verified working connection and a simple needs-attention/not-connected state otherwise.
- First connection launches one provider authorization flow requesting all applicable supported capabilities in plain language: read, write, post, comment, message, follow/join, donation/balance status, and withdrawal/transfer.
- OAuth scopes, APIs, PATs, tokens, refresh and webhook details are implementation concerns and are not exposed as required user knowledge.
- The connection persists until the user disconnects it, except when the provider expires/revokes authorization or requires reauthorization.
- Never mark an unsupported capability as granted. Provider capability discovery and actual authorization are authoritative.

## Shared agent access
A verified OBO connection is available to all of the user's agents. Role purpose determines how it is used:
- Communications: campaign-related comments, messages, mentions, replies and updates.
- Outreach: ethical supporter/community discovery, following/joining and engagement where the provider permits it.
- Finance: provider-verified donation/balance status, reconciliation, authorized transfers/withdrawals where supported, fees and net-available ledger state.
- Strategy/Growth: campaign planning plus grants, relief applications and relevant local/government assistance, with separate specialties.
- Chief of Staff: understands the whole team, delegates with context, tracks work, and uses cross-agent conversation context supplied by platform memory.
- Other agents may use the same connections when an action serves their assigned purpose and is authorized.

## Execution
The same capability layer serves both user-triggered and autonomous work. Automation ON permits authorized autonomous actions. User-triggered features invoke the same connection immediately. A provider limitation always wins over an internal request.

## Fluid handoffs
Agents are interfaces into Interplanetary Fund, not isolated chatbots. Preserve campaign/user context when routing between conversation and tools. Drafts and known selections should be pre-populated when supported. Example: Outreach drafts an update, then opens/routes to the campaign update flow with the draft and destination platform already selected.

## Financial custody
Reading an external donation does not make that money held by Interplanetary Fund. Only a provider-verified settlement/transfer into the platform's holding account may become platform-held/withdrawable value. Ledger entries must preserve gross amount, external/provider fees, transfers, refunds/chargebacks, Interplanetary Fund fees, currency, provenance, and net available to the user.

## Memory and training
Agent conversations and instructions should persist for the user through the platform memory system. Chief of Staff receives cross-agent context when available. Each specialist keeps separate role training; verified knowledge can overlap. Delegated real work and verified outcomes are learning signals, but learning never expands authorization.
