# Agent Runtime and Memory Architecture

## Canonical architecture

- Base44 is the authoritative application, agent runtime, and user-facing conversational environment for Interplanetary Fund.
- Base44 native agent memory is the authoritative memory mechanism for the in-app agent team.
- GitHub main contains the authoritative application configuration synchronized with the Base44 app.
- Do not introduce Convex or Vercel as a second agent-memory runtime for ifund2.

## Agent memory configuration

The nine selectable agents in `src/pages/Agents.jsx` are Chief of Staff, Strategy, Growth, Communications, Story, Finance, Outreach, Discovery, and Managed Connections. Managed Connections requires level 2. Their definitions in `base44/agents/*.jsonc` currently set:

- `memory_config.enabled: true`
- `memory_config.scope: "both"`
- `memory_config.include_other_conversation_context: true` for eight agents; Discovery sets it to `false`.

The separate `admin_builder_agent` is not a selectable agent in this page and also sets cross-conversation context to `false`. These are source settings, not proof that deployed memory behaves as configured. Chief of Staff is configured for cross-agent coordination where the runtime supplies relevant context.

Memory instructions must preserve these boundaries:

- User/campaign-specific facts remain scoped to that user and campaign.
- Generalized learning must not silently convert private user information into shared training.
- Current verified campaign data overrides remembered patterns.
- New explicit user instructions override conflicting remembered preferences.
- Memory never expands permissions, approval scope, financial authority, or external-platform authorization.
- Raw secrets and credentials must never be stored as agent conversational memory. Required integration secrets may be stored and used by the protected backend connection/secret-storage path for authorized platform functionality, while agents and ordinary user-facing reads receive only redacted metadata, connection state, capabilities, or action results.

## Conversation flow

`User -> Base44 Agent Chat -> Base44 conversation -> native Base44 agent memory -> relevant future agent conversations`

The chat UI may create a new conversation session when the selected specialist changes. Continuity comes from the configured Base44 memory system rather than a separate Convex interaction-summary bridge.

## Cross-agent continuity

Eight of the nine selectable agents have cross-conversation context enabled in their definitions. Discovery does not; its memory instructions focus on verified provider capability findings. Specialists with cross-conversation context may use relevant context from other agent conversations while remaining focused on their own role. Chief of Staff has the broadest coordination responsibility and should use available context to avoid making the user repeat known instructions or decisions.

Structured delegation/task tracking remains separate from conversational memory. `AgentDelegation` is the authoritative Base44 record for substantive cross-agent assignments, including source/destination agent, objective, campaign context, real status, result, and verification. Chief of Staff can create/read/update these records. Conversation memory preserves context; delegation records preserve operational state.

## Campaign context isolation

Cross-conversation memory does not make campaign context interchangeable. Campaign-specific facts, drafts, outcomes, beneficiary details, financial information, and instructions must remain anchored to the applicable campaign ID. A campaign title may be retained for readability, but the campaign ID is authoritative.

Before a consequential campaign-specific action, agents should use the current selected/delegated campaign context and current authoritative records. If remembered context belongs to another campaign, it must not be imported into the active campaign. General user-level preferences may carry across campaigns only when they are genuinely user-level.

Structured `AgentDelegation` records therefore preserve `campaign_id` separately from their context summary. When no campaign applies, the field may remain empty rather than guessing.

## Correction and supersession

Memory is not append-only truth. Within the same scope, a newer explicit user correction supersedes an older user-provided fact or preference, and current authoritative platform state supersedes remembered operational state. Repetition of stale information does not make it current.

Corrections must preserve scope: correcting one campaign does not silently change another campaign, and correcting a campaign-specific instruction does not automatically rewrite a user-level preference.

Structured delegated work uses explicit supersession. If a correction still describes the same assignment, update that assignment. If it replaces the assignment, mark the old `AgentDelegation` as `superseded` and link old/new records with the supersession fields. Completed or superseded historical records may remain for accountability but must not be treated as active instructions.

## Provenance and confidence

Remembered information must retain its epistemic category in agent reasoning: explicit user statement, authoritative platform record, verified external result, agent-generated suggestion, or inference/hypothesis. Generated drafts and recommendations are not evidence that their contents are true, and an agent inference must not silently become a remembered user fact.

For operational facts, current authoritative platform records take priority. For user intent and preferences, explicit current user statements take priority. External, financial, authorization, and completion claims should be rechecked against their authoritative source before consequential action when that source is available.

Structured `AgentDelegation` records may carry `context_provenance` entries for important claims, including source type, a non-secret source reference, and confidence. This is especially important when a receiving agent would otherwise be unable to distinguish a user instruction from an earlier agent's suggestion.

## Credential boundary

Credentials are operational secrets, not conversational memory. When a provider requires a token, API credential, app password, webhook verification value, or similar secret, the platform may securely collect, persist, retrieve, refresh, and use that value through its protected backend connection path as needed for authorized functionality.

Raw secret values must not be copied into agent memory, prompts, delegation records, logs, analytics, or ordinary frontend responses. Agent reasoning should normally receive only whether a credential is configured, connection/verification state, granted capabilities, expiry or reauthorization status when applicable, and the result of the requested provider operation.

## Agent roster and official account evidence

The user-facing agent choices are defined in `src/pages/Agents.jsx`; the Base44 chat agent definitions and actual tool permissions are in `base44/agents/*.jsonc`. The `Agent` entity is administrative roster metadata. A roster row or a historical agent alias does not provision a chat agent, grant a tool, or prove that a provider operation succeeded. Check the deployed agent configuration and a real function/provider result before reporting capability or completion.

IFund-owned external account metadata belongs in the admin-restricted `PlatformOwnedAccount` entity. It may hold an opaque `credential_reference`; `AdminCredentialReference` holds only the matching Browserbase-managed secret identifiers and explicit allowed-agent names. The deprecated `AdminCredentialVault` is reference-only. None of these entities is a plaintext password store. An account record marked `setup_in_progress` or `active` is not provider verification by itself; connection and publishing eligibility require provider-backed evidence and the applicable authorization checks. User-owned platform connections remain separate.

The 2026-10-15 dated master-records snapshot was removed from the current tree because it exposed operational account-recovery details and conflated registry claims with deployed permissions, provider verification, and financial policy. Its Git history remains public; operators should review the exposure in their protected admin process and use current application records instead of that snapshot.

This preserves automated platform functionality without requiring users to repeatedly handle credentials and without turning the agent memory system into a credential store.

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

1. All nine selectable agents have memory enabled in the source definitions.
2. Eight selectable agents have cross-conversation context enabled; Discovery has it disabled. The separate admin builder also has it disabled.
3. A runtime check confirms Chief of Staff can use relevant context from specialist conversations when appropriate.
4. Switching agents does not require a Convex/Vercel memory bridge.
5. User-specific memory remains separate from generalized training.
6. Current authoritative data and permissions override remembered information.


---

## Sequential implementation manual

This is the canonical implementation runbook for the configured IFund agent team, related workers and workflow automations. It extends the architecture above rather than defining a second runtime. Source inventory was checked on 2026-11-04. The ten `base44/agents/*.jsonc` files define ten chat agents: nine member-selectable specialists/coordinators and one separate admin builder. The seventeen `base44/workflows/*.jsonc` files define background automations, not seventeen additional conversational identities. Display aliases in `src/lib/agentIdentity.js` and fallback roster rows in `src/components/ops/inAppAgentRoster.js` do not provision additional agents.

**Documentation status:** these are creation, implementation and activation instructions. They are not a claim that any Cloudflare execution adapter, provider grant, production DNS route, remote skill, memory migration or external action has been verified. Current workforce/workflow Workers are inspection-only. No application ZIP was available for this inventory. If another supplied artifact contains additional agents, inventory and reconcile it here before claiming complete coverage of that artifact.

Follow this reading and implementation order:

1. Complete [shared preparation](#shared-preparation-and-selections).
2. Implement and verify [the workers](#worker-by-worker-implementation) with execution disabled.
3. Complete each [agent chapter](#agent-by-agent-implementation) in order, including its release record, before enabling the next agent. Documentation for every agent is provided; this does not mean the previous agent has passed a live release gate.
4. Attach only the [workflow triggers](#workflow-by-workflow-implementation) whose dependencies and single-executor ownership have passed verification.
5. Run the [live connection and rollback procedure](#connecting-to-interplanetaryfundcom-and-release-evidence).


### Individual chapter index

Read each complete chapter in sequence; these links are for returning to a specific item.

**Worker chapters**

- [1. public gateway and application entrypoint](#worker-implementation-1)
- [2. agent workforce](#worker-implementation-2)
- [3. workflows and triggers](#worker-implementation-3)
- [4. email ingress](#worker-implementation-4)
- [5. standalone OAuth adapter (dormant, not the canonical MCP issuer)](#worker-implementation-5)

**Agent chapters**

- [1. Chief of Staff (`chief_of_staff`)](#agent-implementation-1)
- [2. Strategy (`strategy_agent`)](#agent-implementation-2)
- [3. Growth (`growth_agent`)](#agent-implementation-3)
- [4. Communications (`communications_agent`)](#agent-implementation-4)
- [5. Story (`story_agent`)](#agent-implementation-5)
- [6. Finance (`finance_agent`)](#agent-implementation-6)
- [7. Outreach (`outreach_agent`)](#agent-implementation-7)
- [8. Connection Discovery (`connection_discovery_agent`)](#agent-implementation-8)
- [9. Managed Connections (`managed_connection_agent`)](#agent-implementation-9)
- [10. Admin Builder Coordinator (`admin_builder_agent`)](#agent-implementation-10)

**Workflow chapters**

- [1. AI Outreach Agent](#workflow-implementation-1)
- [2. Admin Action Conversation Router](#workflow-implementation-2)
- [3. Campaign Protocol](#workflow-implementation-3)
- [4. Campaign Sync on Create](#workflow-implementation-4)
- [5. Campaign Sync on Update](#workflow-implementation-5)
- [6. Connection Sync Engine](#workflow-implementation-6)
- [7. External Feed Mirroring](#workflow-implementation-7)
- [8. Feature Discovery on Completion](#workflow-implementation-8)
- [9. Grant Application Review](#workflow-implementation-9)
- [10. IFund Official Social Editor](#workflow-implementation-10)
- [11. IFund Reporter Daily Diary](#workflow-implementation-11)
- [12. Integration Health Check](#workflow-implementation-12)
- [13. PayPal Holding Settlement Reconciliation](#workflow-implementation-13)
- [14. Platform Account Steward](#workflow-implementation-14)
- [15. Social Media Autopilot](#workflow-implementation-15)
- [16. Volunteer Welcome Follow-up](#workflow-implementation-16)
- [17. Weekly Writing Psychology & Social Trends Training](#workflow-implementation-17)

### Shared preparation and selections

#### 1. Establish the exact application, revision and authority

Use `docs/CANONICAL_WORK_MAP.md`: AI/agents is [#484](https://github.com/interplanetarysister/interplanetary-fund2/issues/484), runtime/deployment is [#481](https://github.com/interplanetarysister/interplanetary-fund2/issues/481), permissions #477, financial integrity #478, connections #479 and portability #482. Extend the existing work; do not open another competing tracker or create another agent merely to bypass a missing adapter. Public discovery on 2026-11-04 found both #484 and #481 open and an existing [#545 agent/workflow staging change](https://github.com/interplanetarysister/interplanetary-fund2/pull/545). Inspect its current state and other open PRs before implementation. Repository history is evidence, not live deployment proof.

Select the existing `Interplanetary Fund` Base44 application, not a similarly named copy. Verify its identity against `docs/IFUND_AGENT_CONNECTION_AUTHORITY.md` through an authorized platform read. Never infer the published revision from a repository filename. Record the source revision, deployed backend revision, Cloudflare Worker version, public hostname and test environment independently. Preserve Base44 as the current writable authority for identities, campaigns, donations, connections, conversations, memory and delegation. Do not provision a second ledger or identity authority as part of agent setup.

Read `AGENTS.md`, `docs/ZERO_CREDIT_CONTINUOUS_WORK.md`, `docs/REPOSITORY_SOURCE_OF_TRUTH.md`, `docs/HOST_PORTABILITY_AND_ADMIN_AGENT_CONTRACT.md`, `docs/AGENT_TRAINING_CORE.md`, `docs/IFUND_AGENT_CONNECTION_AUTHORITY.md`, and `docs/deferred-base44-workflows.md`. Older skill guides contain historical permissions and rate/fee descriptions; actual current JSONC, entity RLS, shared guards and backend code control behavior. Resolve contradictions from those sources, never from a prompt that asks for more access.

#### 2. Select the implementation mode explicitly

Before implementing each new adapter, repair or significant enhancement, complete the repository's GitHub reuse gate. Describe the exact missing capability, inspect existing IFund code and canonical open work, search GitHub, and verify candidate source repositories. Record license and dependency/trademark constraints, maintenance, known security issues, Worker/runtime compatibility, privacy/credential handling, real operating costs, chosen reuse/adaptation/original-code decision, tests and rollback in the canonical tracker. Public source is not proof of an open-source license or a functioning live connection. Existing discovery in `docs/deferred-base44-workflows.md` evaluated Workers SDK, Temporal and Inngest for the prior preparation; it is evidence to recheck for the particular implementation, not blanket clearance to install any of them. Documentation-only inventory here installed no library or service.

| Selection | Use | Required result |
| --- | --- | --- |
| Preserve Base44 agent execution; Cloudflare gateway only | Current least-change integration path | Same authenticated Base44 conversation, tools, memory and data; verified proxy/CORS; no duplicate scheduler |
| Cloudflare execution in shadow mode | Preparation for independent execution | Read-only comparison against Base44; no publishing, messaging, financial or production-record mutations |
| Cloudflare execution as owner of a scoped action | Future controlled activation | Verified identity, equivalent tool permissions/RLS, memory, durable idempotency, audit, provider access and explicit reversible cutover for that action |
| Native Base44 skill/configuration synchronization | Only after complete remote reconciliation and separately approved platform access | Full remote backup, non-destructive diff, exact skill-ID preservation and rollback; never partial skill replacement |

The owner requested Cloudflare implementation/activation, but source presence does not satisfy the cutover conditions. Missing gates remain blocked. No instruction here authorizes metered activity while the zero-credit rule remains active. Check actual provider plan and limits, and forbid paid overflow rather than assuming a free account means free inference or execution. Local documentation/static tests require no provider calls. Do not trigger an agent, workflow or provider merely to test whether credits remain.

#### 3. Prepare local tooling without deploying

Use the existing Node >=20 runtime policy; verify `node --version`, `npm --version`, and `command -v node` before dependency work. Preserve `package.json`/lockfile. Use existing local dependencies; do not install the Cloudflare SDK into the product just to obtain a CLI. Do not run a website build or an Android packaging workflow as part of following these source-inspection instructions. The hosting pipeline validates the website separately. Android is manual-only and unrelated to agent release.

Useful source-only commands, run from repository root:

```sh
node scripts/verify-cloudflare-workforce-stage.mjs
node scripts/verify-cloudflare-workflows.mjs
node scripts/test-cloudflare-workforce-bootstrap.mjs
node scripts/test-cloudflare-workflows.mjs
node scripts/verify-agent-runtime-dependencies.mjs
node scripts/verify-agent-write-capabilities.mjs
node scripts/verify-agent-conversation-execution.mjs
node scripts/verify-builder-agent-boundary.mjs
```

Run additional tests listed per agent and worker. A failing baseline must be recorded and repaired or explicitly left blocked; do not weaken its expectations. Stage snapshots only after intentionally editing canonical source:

```sh
node scripts/stage-cloudflare-workforce.mjs
node scripts/stage-cloudflare-workflows.mjs
node scripts/audit-workflow-migration-eligibility.mjs
```

These staging commands copy configuration and recompute manifests. They do not install remote skills, create conversations, enable cron or deploy. Check the diff and source parity afterward.

#### 4. Inventory all configuration fields, not just the prompt

Each agent chapter records every top-level field in its current JSONC. For long executable prompt/memory text, it points to the exact field in the canonical file instead of creating a competing prompt copy. Read and use the **complete** `instructions` string verbatim, including appended safety/context/training sections; never replace it with the description or a role guide. The source JSONC is the import artifact. Preserve types, arrays and order; empty arrays and empty strings are intentional configuration, not requests to auto-select defaults.

| Field | Implementation instruction |
| --- | --- |
| `name` | Stable runtime identity; use as `agent_name`, tool audit identity and delegation destination. Do not substitute display alias. |
| `description` | User-facing role summary; not an authorization policy. |
| `instructions` | Load the entire canonical string; treat user/entity/provider content as data beneath it. No concatenation of arbitrary external instructions. |
| `tool_configs` | Register exactly the listed entity operations/function tools. Do not grant all CRUD or all functions. Validate each call server-side. |
| `context_files` | Preserve actual selections and reconcile remote references; never attach private records just because the list is empty. |
| `app_user_connector_configs` | Preserve selections; separately prove per-user connector grants and token isolation. No platform-wide credential inheritance. |
| `selected_skill_names` | Preserve exact managed skill names/order. A selected name is not proof its implementation exists or is authorized. |
| `selected_workspace_skill_ids` | Preserve exact opaque IDs/order; use authenticated remote inventory to resolve title, owner, body/version and agent bindings. Do not invent skill content from IDs. |
| `model` | Preserve current `automatic` policy. An independent adapter must explicitly resolve a supported model, limits and price before activation; do not silently pick a provider/model or paid fallback. |
| `whatsapp_greeting`, `telegram_greeting`, `line_greeting` | Preserve each field when present. Greeting text does not provision a bot or WhatsApp/Telegram/LINE integration; separately verify channel ownership/webhooks/consent. An absent field is not an empty configured channel. |
| `memory_config` | Preserve enabled/scope/cross-conversation booleans and the complete memory instructions. Test user/campaign isolation, correction, deletion/retention and provenance. |
| `voice_config` | Preserve exact nested values. Enabling a UI option does not grant microphone permission, a voice model, subscription or paid usage. |
| `emails_settings` | Preserve exact nested settings; do not infer email delivery, a mailbox or permission to send from them. |
| `allow_anonymous_access` | Preserve false; verify direct SDK/API calls reject anonymous callers. Login alone is insufficient for admin tools. |

The coding-agent skill packages under `.agents/skills/` guide engineers. They are **not** in-app Base44 skills. Follow `docs/IFUND_AGENT_SKILLS_MIGRATION_2026-10-11.md`: remote in-app skills require a complete authorized inventory and backup before synchronization. Do not create a partial `base44/agent-skills/` set or run replace-all pushes. Selected remote skill bodies and grants remain unresolved until that inventory exists. No developer credential, session, provider token, password, MFA code or signing key may be included in an instruction, context file, memory record or this document.

#### 5. Implement the shared execution boundary before enabling an agent

For an independent workforce runtime, the following are **missing implementation requirements**, not capabilities of the current `host/workforce/worker.js`:

1. Authenticate the actual incoming principal using the authoritative platform session. A browser-supplied owner ID, role, agent name or origin is not identity. Never accept an admin service credential as a substitute for the member whose records are being accessed.
2. Resolve the selected stable agent name from an allowlist. Enforce account-active status, AI subscription, per-agent tier, feature flags and admin separation on the server. Recheck at each tool call and resumed job.
3. Build structured context using current authorized campaign/account records. Carry owner ID and campaign ID as server-validated scope. Use `getAgentAccountContext` for redacted connection/account facts and `getVerifiedIFundIntegrationContext` for fresh provider setup facts where allowed. Do not send raw credentials to the model.
4. Load the canonical instructions and only the skills the remote inventory actually resolved. Register each tool with a typed input schema derived from its existing backend validator; reject unknown fields/modes where the backend does. Keep entity operations behind RLS-equivalent owner checks. Do not expose service-role entity CRUD to the model.
5. Either invoke the canonical Base44 function in the user's authenticated context or implement a separately tested equivalent adapter without changing production authority. Copying Deno code into Workers without replacing `npm:` imports, SDK auth and service-role behavior is not a port. Maintain backend function URLs as protected runtime configuration discovered from actual deployment metadata; never derive an endpoint by guessing a hostname/path pattern.
6. Implement bounded conversation/tool iteration, timeouts and cancellation. Stop on required approval, provider MFA, permission failure, budget exhaustion or uncertain write outcome. Never let agent A call agent B recursively without a delegation record and bounded continuation policy.
7. Keep authoritative conversation/memory in Base44 during preparation. An independent memory adapter needs explicit ID mapping, tenant/campaign isolation, correction/supersession, retention/deletion and verified migration before it becomes writable. Context sharing must not become cross-user data sharing.
8. Persist job/approval/idempotency/audit records through the approved authoritative backend, not module variables or local JSON files. Use atomic uniqueness/claim operations for side effects; do not treat the current recent-record duplicate search as a universal atomic lock. New storage infrastructure requires its own approved platform design and parity review, not an opportunistic second production database.
9. Keep draft creation, owner approval, provider execution and result verification distinct. The model cannot approve its own draft or call owner-only `ownerAgentChatActions`. An informational answer may complete after a response; a write completes only after authoritative record/provider evidence.
10. Record safe request/operation ID, owner, campaign, agent, exact tool/action, approval reference, source revision, timestamps, outcome, retry state and non-secret evidence reference. Redact prompts, tool errors, logs and traces. A provider timeout after submission is `uncertain`; reconcile before retrying.

The current workforce `/v1/workforce/execute` path returns 503. Do not build a client that assumes a success payload from it. Define and implement a versioned execution API with request/response schemas, authenticated streaming/status/cancellation and tests before routing production to it. The existing Base44 SDK chat contract is the working reference; do not invent a live Cloudflare conversation API in setup instructions.

#### 6. Connect tools and owner review

The tool tables in each chapter are exact current selections. Read the linked implementation's input parser, validators, imported guards and error paths before wiring a function schema. Never assume that a tool's description documents all arguments. Shared contracts:

- `getAgentAccountContext` and `getWritingResearchBrief` are context reads; source date/provenance and absent data must remain visible.
- `manageAgentContentDraft`: modes `list`, `create`, `revise`, `cancel`; no agent approval/publish mode. Create accepts `kind`, `source_agent`, scoped `campaign_id`/`connection_id` where applicable and `payload`. Revise/cancel use `draft_id`; destination selectors cannot change during revision. Draft status must still be `draft`.
- Supported draft kinds and payload fields are listed below. Respect exact sanitizer limits/types in `base44/functions/manageAgentContentDraft/entry.ts`; absent required campaign/connection/membership/ownership fails closed.
- `routeAgentTask`: `dispatch` or `status`. Dispatch uses `source_agent`, registered `capability`, matching `target_agent`, objective (8–900 characters), optional `context_summary` (up to 1500) and owned `campaign_id`; status uses `delegation_id`. Registered capability pairs are in its `SPECIALISTS` map. Builder is never a specialist target. A handoff creates an actual conversation and `AgentDelegation`, not an approval grant.
- `requestManagedConnectionAction`: `connect`, `create_account`, `repair`, `reauthorize`; `platform`, optional `campaign_id`, and owned `connection_id` (required for repair/reauthorize). Requires the managed-connections feature, eligible subscription and current unified OBO grant. A `waiting_user` result is not connected.
- `sendCommunication`: validate `campaign_id`, `subject`, `content`, `comm_type`, `audience`, `channels`, `ai_generated` against its actual backend; require exact approved message/recipient scope, preferences and delivery receipts. Do not use it for unsolicited platform-wide mail.
- `runBrowserConnection`: inspect the current allowed read actions and deferred behavior; never claim arbitrary browser posting, account creation or MFA bypass. A skill advertising broader automation does not widen the backend.
- `manageAdminBuilderWork`: `list` or `queue`; queue uses objective (minimum 12, maximum 500 characters) and context summary (up to 1800), and returns `requested`, `implemented:false`. A queue record is not a source edit.
- `managePlatformIncidents`: preserve the actual backend modes and super-admin checks, investigation evidence, exact incident approval and separate builder release controls. The presence of a frontend error is not authority to run it as code.

| Draft kind | Allowed payload keys |
| --- | --- |
| `social_post` | `content`, `media_url`, `campaign_id` |
| `campaign_update` | `title`, `content`, `media_url`, `media_type` |
| `campaign_changes` | `title`, `summary`, `story`, `category`, `goal_amount`, `cover_image_url`, `end_date`, `location`, `ai_profile`, `status` |
| `external_post` | `content`, `donation_destination_connection_id`; target campaign/connection are top-level selectors |
| `blog_entry` | `blog_id`, `entry_id`, `title`, `summary`, `body` |
| `discussion_post` | `community_id`, `title`, `content`, `category` |
| `discussion_reply` | `post_id`, `content` |
| `profile_update` | `display_name`, `bio`, `focus_campaign_ids`, `priority_campaign_id`, `show_posts`, `show_communities` |

Use `src/components/agents/AgentContentReview.jsx`, `base44/functions/applyAgentContentDraft/entry.ts` and the existing publishing functions for owner review. `src/components/agents/AgentChat.jsx` handles explicit owner approval commands through the owner-only boundary; do not attach that boundary as an agent tool. See `docs/AGENT_CHAT_ACTIONS_HANDOFFS_2026-10-13.md` for batch bounds and truthful published/manual/uncertain outcomes.

#### 7. Required tests for every agent, before moving to the next

Prepare two separate test users, two campaigns owned by different users, a disabled account, an expired/ineligible subscription, an authenticated non-admin and an approved super-admin. Use synthetic data in a nonproduction fixture, never another person's production data.

For each agent: test anonymous denial; own-scope success; other-owner record denial even when IDs are supplied directly; revoked consent; expired subscription; disabled feature; direct tool/API bypass attempts; injected campaign/provider instructions; secret redaction; cross-campaign memory isolation; newer correction superseding memory; cancellation; budget limits; duplicate requests; and truthful failure/uncertain states. Test allowed operation succeeds and every unselected entity operation/tool is denied. UI hiding alone does not pass.

Store a release record in the canonical tracker with agent stable name, source/config hashes, resolved skill versions, model policy and confirmed cost ceiling, test fixture references, backend revision, Worker version, deployment target, role/grant evidence, positive and negative results, observer/reviewer, rollback revision, and unresolved items. Never store credentials or private message bodies. Mark `source-verified`, `shadow-verified`, and `live-verified` separately. Only then move to the next activation.

### Worker-by-worker implementation

The following sections describe every Worker entrypoint checked into `host/`. Deploying a catalog Worker does not implement the chat agents inside it. Cloudflare dashboard labels and CLI versions may change; select resources by the exact configured identity and verified account, not guessed screen positions.

<a id="worker-implementation-1"></a>

#### Worker 1 — public gateway and application entrypoint

Source: [`host/gateway/worker.js`](../host/gateway/worker.js), [`host/gateway/campaign-assistant.js`](../host/gateway/campaign-assistant.js). Production configuration: [`wrangler.toml`](../wrangler.toml). The additional `host/gateway/wrangler.toml` describes a separately named admin gateway; do not accidentally deploy it as a second production authority or overwrite the existing `interplanetary-fund2` Worker.

1. In the authorized Cloudflare account, open Workers & Pages and select the existing Worker matching root Wrangler's `name`. Inspect and retain its current version, compatibility date, routes, custom domains, assets, variables, encrypted secrets and bindings. Confirm the account has the necessary Workers deployment and zone/DNS read access; DNS edits require a separate narrowly scoped grant. Do not request blanket account permission.
2. Keep `main = host/gateway/worker.js`, asset binding `ASSETS`, the repository's compatibility date and `keep_vars = true`. Asset directory `dist` belongs to the website pipeline, not a new agent build. Preserve `run_worker_first` for API/MCP/admin/discovery paths; HTML at an API URL is a routing failure.
3. Preserve the canonical Base44 origin. Set exact allowed browser origins rather than `*`. Populate admin verification, execution and audit URLs from the actual deployed functions and verify HTTPS. Configure admin/session secrets only in protected server settings. Never place them in `VITE_` variables.
4. Preserve the original authenticated caller for Base44 tool execution. The admin gateway must independently verify the current super-admin; a correct admin key does not authorize an ordinary member.
5. Wire the UI through `src/lib/adminAgentGateway.js` and `src/components/agents/AdminDevelopmentChat.jsx`. `VITE_ADMIN_AGENT_API_URL` is the public gateway URL, not the admin key. Verify actual UI route configuration before publishing a deep link.
6. Test MCP, REST feed and admin paths separately. MCP discovery continues proxying the canonical Base44 OAuth issuer; do not replace it with the standalone OAuth worker merely because both have a discovery route.
7. Preserve migration-auth/campaign preview handlers as explicitly gated preview functionality. They reference existing alternate-backend configuration in source; they are not permission to switch identity or data authority.
8. Campaign-assistant inference is a separate dormant route, not an agent executor. Follow `host/gateway/README.md` for model terms, auth, rate limiting, AI binding and confirmed budget before enabling it. Preserve no-paid-fallback behavior.

Current implemented access points:

| Method/path | Access and behavior |
| --- | --- |
| `GET /api/health` | Public liveness; must return JSON identifying Cloudflare Worker compute |
| `GET /api/health/readiness` | Inspect the current handler's readiness contract; liveness alone is insufficient |
| `/api/mcp`, `/api/mcp/*`, `/api/apps/*/mcp` | Canonical Base44 MCP proxy; retain upstream authorization and errors |
| `/.well-known/oauth-*`, `/.well-known/openid-configuration` | Canonical discovery proxy; preserve issuer/audience consistency |
| `POST /v1/admin/agents/session` | Approved origin + actual super-admin + protected admin-key comparison; returns signed 900-second session |
| `POST /v1/admin/agents/message` | Same authenticated user + valid session; exact gateway allowlist applies |
| `POST /v1/admin/agents/status` | Same authenticated user + valid session + activity ID; reflects real conversation/tool status |
| `GET /api/v1/agent/campaigns` | Scoped external-agent credential forwarded to canonical feed; no donor or financial write authority |
| `/api/v1/agent/content` | Existing content API proxy; preserve backend consent and owner gates; do not infer write scope from campaign read access |
| `POST /api/v1/campaign-assistant` | Dormant generation path; independent feature/budget/binding gates |
| `/api/v1/migration/auth/session`, `/api/v1/migration/campaigns` | Preview-only migration handlers; not agent authentication authority |

**Known gateway mismatch:** `executeAdminAgentRequest` allows `admin_builder_agent`, but the Cloudflare `/message` allowlist currently contains only `chief_of_staff`, `connection_discovery_agent`, `managed_connection_agent`, `outreach_agent`. Do not claim builder access through that Cloudflare path. Repair only through a reviewed exact-name allowlist change with anonymous/non-admin/session/direct-backend tests, and preserve the builder's restricted tools.

Verification: `scripts/test-cloudflare-mcp-proxy.mjs`, `scripts/verify-cloudflare-runtime-contract.mjs`, `scripts/verify-live-cloudflare-pathway.mjs`, `scripts/verify-public-agent-rest-route.mjs`, `scripts/test-campaign-assistant-gateway.mjs`, and relevant admin transport tests. Read each test before running; keep source-only tests separate from network/live tests. Rollback: restore the previous Worker version and routes plus the prior public gateway setting, pause new agent actions, reconcile accepted writes before resuming.

<a id="worker-implementation-2"></a>

#### Worker 2 — agent workforce

Source: [`host/workforce/worker.js`](../host/workforce/worker.js); configuration: [`host/workforce/wrangler.toml`](../host/workforce/wrangler.toml); exact snapshots and skill paths: [`host/workforce/manifest.json`](../host/workforce/manifest.json).

1. Select the existing `ifund-workforce` service only after verifying its actual account/resource identity. Source declares `workers_dev = true`, no production custom-domain route, execution disabled. Do not assume a `workers.dev` hostname or deployed service exists from this declaration.
2. Verify snapshot parity and remote skills before packaging. Deploy the inspection service in a separate preview/staging environment first, without production write credentials, and inspect `/health`, `/v1/workforce/catalog`, `/v1/workforce/readiness`.
3. Implement every shared execution-boundary requirement above before enabling calls. Current `/v1/workforce/*` execution requests return 503; setting `IFUND_WORKFORCE_EXECUTION` alone changes no implementation. Define and test the execution API before adding a production route or service binding.
4. Register one stable agent at a time from its chapter. Load only its own tool list and resolved skills. Preserve common memory policy without collapsing user/campaign boundaries.
5. If public access is eventually required, add an explicit versioned route, authentication, exact-origin CORS, rate limits and status/cancellation contract. Alternatively use a private Cloudflare service binding from the gateway after that binding and its caller identity contract are implemented. No such binding is currently declared; it must not be described as connected.
6. Use shadow fixtures first. Route only the verified action/agent after parity and single-executor ownership pass. Roll back by routing the agent to its existing Base44 path; stop new Cloudflare jobs and reconcile in-flight ones before retry.

Verification: `test-cloudflare-workforce-bootstrap.mjs`, `verify-cloudflare-workforce-stage.mjs`, plus each agent's own tests and hosted owner-isolation tests. `/health` must remain `ready:false` until runtime evidence supports readiness.

<a id="worker-implementation-3"></a>

#### Worker 3 — workflows and triggers

Source: [`host/workflows/worker.js`](../host/workflows/worker.js); configuration: [`host/workflows/wrangler.toml`](../host/workflows/wrangler.toml); manifests: [`manifest.json`](../host/workflows/manifest.json), [`eligibility.json`](../host/workflows/eligibility.json).

1. Preserve `ifund-workflows`, the configured compatibility date, and disabled execution. There are intentionally no `[triggers]` cron entries. Current `scheduled()` only logs a disabled outcome; it does not dispatch functions.
2. Verify all seventeen source definitions before deployment. Inspect `/health`, `/v1/workflows/catalog`, `/v1/workflows/readiness` and `/v1/workflows/preview`. Preview accepts either exact `name`, or `entity` plus `event=create|update|delete`, and never executes. It retains literal source expressions and does not evaluate condition/authorization.
3. Implement a trusted event-ingress and scheduler contract. Entity events must originate from an authenticated canonical backend, not arbitrary browser JSON. Validate issuer/signature, timestamp, owner, campaign, event ID/type/version and replay cursor. Derive authority server-side; a caller's supplied role is not sufficient.
4. Implement durable jobs with unique logical run keys, atomic claim, bounded lease, heartbeat/expiry, attempt limit, cancellation, wait-until, evidence and terminal outcome. Keep payloads minimal and reference authoritative records. Recheck account, consent, subscription and resource ownership after every delay. An in-memory Set or a manifest JSON file is not a job store.
5. Schedule in each source timezone. Cloudflare Cron expressions are UTC; the source's `America/Los_Angeles` schedules must retain daylight-saving behavior. Prefer a bounded UTC heartbeat plus timezone-aware due selection and unique logical schedule-slot keys; do not paste local-time cron as UTC. Persist the last evaluated slot so deployments/outages do not create unbounded catch-up bursts. Specify missed-run policy explicitly and test DST repeats/skips.
6. Preserve step IDs, ordering, `then` transitions, function arguments, source conditions, one-time/interval fields and end-date/count constraints. Resolve `${ .trigger.entity_id }` only from an authenticated stored event, never by evaluating it as JavaScript. Unsupported DSL features must block the workflow rather than silently dropping them.
7. Dispatch only allowlisted functions through equivalent canonical authorization. No general arbitrary function-name endpoint. The event/scheduler service role must not become a member's unrestricted tool role.
8. Claim executor ownership for each workflow before activation. Inventory Base44's enabled state, last success, pending jobs and delayed follow-ups. Drain/disable only the separately approved overlapping schedule after checkpointing. Do not run both against production mutations.
9. Add only the verified scheduled workflows in Cloudflare's Cron Triggers settings or controlled Wrangler configuration after duplicate protection/parity review. Entity workflows need authenticated ingress, not a cron entry. Test one bounded fixture event/run before general activation.
10. Rollback: stop new Cloudflare claims, preserve pending/uncertain receipts, reconcile actual provider outcomes, restore the previous executor and replay only confirmed safe unexecuted logical runs. Never reset deduplication keys to force a retry.

The workflow chapters below are the exact trigger/step inventory. None is activated by this document. Verification: `test-cloudflare-workflows.mjs`, `verify-cloudflare-workflows.mjs`, plus durable scheduling/replay/timezone/negative-authorization tests that must still be implemented for a real executor.

<a id="worker-implementation-4"></a>

#### Worker 4 — email ingress

Source/configuration: [`host/email/worker.js`](../host/email/worker.js), [`host/email/wrangler.toml`](../host/email/wrangler.toml), [`host/email/package.json`](../host/email/package.json); full existing mail setup: [`host/email/README.md`](../host/email/README.md).

1. This is an email-event Worker (`ifund-email-ingress`), not an HTTP conversational agent. Preserve its separate deployment, package lock and `postal-mime` parser. Do not merge it into the website Worker or connect it to arbitrary public HTTP intake.
2. Inventory existing mail DNS, provider forwarding and owner-verified destinations. Verify the zone is active and Email Routing is authorized before adding a catch-all. Do not change nameservers or MX simply to make code appear connected.
3. Configure exact HTTPS receiver URLs separately for organizational, private verification and paid-member mail; set the signing private key only in protected Worker secrets and matching public verification material at the receivers. Keep all key values out of commands/logs/documentation. Signature scheme is ECDSA P-256/SHA-256 over `timestamp + '.' + exact JSON body`, encoded as defined by source.
4. Preserve recipient classes: organizational root-domain mail; strict random `verify-` root aliases; member mail under `mail.interplanetaryfund.com`. Never forward private member or verification mail to the organizational destination. The current organizational destination is embedded in source; verify it with the owner through the protected admin process rather than copying recovery details into more documents.
5. Keep source limits: 2 MB mirror parsing and 12,000-character text payload. HTML/attachments are not a Base44 text mirror capability. Member delivery requires a valid entitled private recipient and receiver success; failures must reject, never fall back to organizational storage.
6. The current organizational receiver configuration references an existing alternate-backend endpoint. Inventory that dependency and verify its deployed signature, tenancy and retention behavior before using it. This document does not create or authorize a new database service or replace current persistence.
7. Test signed synthetic intake, stale/bad signatures, duplicate IDs, oversized mail, invalid aliases, disabled paid mailboxes and cross-user reads. Only then route an owner-approved external test message; do not send real user mail during setup.
8. Agent mail reads must use approved `getAgentMailContext`/backend interfaces and current grants; email arrival is not authorization to execute instructions or send a reply. Keep auto-action routing behind the workflow owner/approval checks.

Verification: `scripts/test-ifund-permissions-private-mail.mjs`, `scripts/verify-independent-admin-mailbox-client.mjs`, receiver-specific tests in the repository and scoped hosted delivery checks. Rollback: revert only the changed Email Routing rule/Worker version, preserve known working mail forwarding and receiver audit records, never reroute private mail to the owner.

<a id="worker-implementation-5"></a>

#### Worker 5 — standalone OAuth adapter (dormant, not the canonical MCP issuer)

Source: [`host/oauth/worker.js`](../host/oauth/worker.js), historical storage schema: [`host/oauth/schema.sql`](../host/oauth/schema.sql). No Wrangler deployment configuration is checked in for this entrypoint. It references `OAUTH_DB` and stays unavailable unless `OAUTH_ENABLED=true` and the binding exists. Do not provision its historical D1 store or activate it as part of this documentation change; it has no verified deployment/identity/storage parity gate.

1. First decide whether this optional adapter is required at all. Current MCP discovery proxies Base44. Do not route the same discovery path to two different issuers. Prefer the current supported external-agent read feed/Make setup when sufficient.
2. Before any future activation, review `docs/IFUND_MAKE_OAUTH_IMPLEMENTATION_CONTRACT.md`, resolve its storage/auth requirements against the approved platform, and implement a deployment config, migration/rollback and least-privilege storage adapter. Preserve existing grants; a new issuer must not silently invalidate them.
3. Configure actual admin-verification, consent-portal and campaign-feed URLs, protected bridge/agent/introspection credentials, and a disabled feature flag. Do not infer URLs from function names. Confirm each secret's purpose and rotation independently.
4. Current optional endpoints: discovery; `/oauth/admin/clients` GET/POST; `/oauth/admin/clients/revoke` POST; `/oauth/authorize` GET; `/oauth/admin/authorize` POST; `/oauth/token` POST; `/oauth/revoke` POST; `/oauth/inspect` POST; `/api/v1/oauth/campaigns` GET. Admin paths require verified super-admin or the protected bridge; introspection requires its separate secret.
5. Supported scope is only `campaigns:read`. The source's callback allowlist is exact; inspect it rather than permitting wildcard redirect URIs. Preserve state validation, exact redirect matching, S256 PKCE behavior, one-use authorization codes, 180-second code expiry, 900-second access expiry and 30-day refresh expiry. Test refresh reuse/revocation and client disablement.
6. Audit token parsing, optional/required PKCE policy, request-size enforcement, transactions and fail-closed response behavior before activation. Source implementation is not security approval. Confirm a real consent flow returns to the registered caller and grants no publishing/donor/admin access.
7. Rollback by restoring canonical discovery/feed routes and disabling this adapter, then reconciling/revoking only its own issued grants. Do not delete existing Base44 OAuth grants.

### Worker packaging and deployment commands (future gated operation)

These commands document the exact configuration choice for an authorized operator; they were **not run** for this documentation task. Deployment remains blocked until the relevant account, free-plan/budget, permissions, configuration backup and release gates above pass. Use the repository-approved Wrangler v4 toolchain already available in the authorized release environment; do not install it into application dependencies just to follow this manual. Authenticate through the protected Cloudflare connection, with no credentials embedded in command text or output. Inspect package/lockfile changes before any dependency installation.

| Worker | Packaging and deployment procedure |
| --- | --- |
| Public gateway/site | Use the existing authorized `.github/workflows/deploy-cloudflare.yml` / release path with root `wrangler.toml`. Its website pipeline supplies validated `dist` assets. Do not deploy this config without those assets or substitute another host's output. Explicit CLI target after that gate: `wrangler deploy --config wrangler.toml`. |
| Workforce | Verify source snapshots and tests, then `wrangler deploy --config host/workforce/wrangler.toml` in the selected staging account/environment with no production routes/write grants. This packages the current catalog, not a completed runtime. |
| Workflows | Verify source snapshots/eligibility/tests, then `wrangler deploy --config host/workflows/wrangler.toml` with no cron triggers. Deploying it does not implement missing event/durable-job adapters. |
| Email ingress | Resolve the locked parser dependencies using the existing `host/email/package.json`/lockfile in the authorized packaging environment; inspect existing package scripts first. Deploy explicitly with `wrangler deploy --config host/email/wrangler.toml`. Route real mail only after receiver/signature/tenant tests and mail/DNS review. |
| Standalone OAuth | No deployment command is valid yet: configuration, approved storage adapter, issuer separation and security/parity gates are missing. Do not borrow another worker's configuration. |

A CLI deployment without an environment selector targets that config's default environment. Do not invent `--env staging` unless a matching environment block and separate bindings exist; add/review isolated preview configuration before using it. Never accidentally deploy to production to obtain a preview. Record account and resource identity without printing authentication material. In the dashboard, verify the exact Worker version and setting diff after the deployment. Where uploads/build packaging can incur costs, the zero-credit and authorization gates still apply.

### Agent-by-agent implementation

Complete the numbered procedure, settings, tool wiring and acceptance checks for each chapter before treating that agent as live. All settings below are source inventory, not observed deployment state. Function and entity links are relative to this document.

<a id="agent-implementation-1"></a>

#### Agent 1 — Chief of Staff (`chief_of_staff`)

**Description:** Chief of Staff — the central coordinator of the Interplanetary Fund AI agent team. Always on. Synthesizes campaign performance, prioritizes the day's work, and routes the organizer to the right specialist agent (strategy, growth, communications, story, finance, outreach).

**Implementation objective:** Coordinate the owner’s current priorities, retain campaign-scoped context and create traceable specialist handoffs without inheriting the specialist’s permissions.

**Canonical definition:** [`base44/agents/chief_of_staff.jsonc`](../base44/agents/chief_of_staff.jsonc). Source SHA-256 at this inventory: `eccac6ca3b31066d0c5817550834bd6a092348bb170e87d66459c993d1fda313`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skill:** [`.agents/skills/ifund-chief-of-staff/SKILL.md`](../.agents/skills/ifund-chief-of-staff/SKILL.md). Read its referenced complete role guide where present, plus [`.agents/skills/ifund-content-writes/SKILL.md`](../.agents/skills/ifund-content-writes/SKILL.md) for owner context/drafts. Do not install engineering SKILL.md as a remote conversational skill.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Chief of Staff — the central coordinator of the Interplanetary Fund AI agent team. Always on. Synthesizes campaign performance, prioritizes the day's work, and routes the organizer to the right specialist agent (strategy, growth, communications, story, finance, outreach)."` |
| `instructions` | Use full `instructions` in [`base44/agents/chief_of_staff.jsonc`](../base44/agents/chief_of_staff.jsonc); 14845 characters. Do not truncate or replace with role description. |
| `tool_configs` | 16 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `["connections-webproxy"]` |
| `selected_workspace_skill_ids` | `["6ab4798715c82e0e88c70efe","6ab46f2180895ff2754f1d03","6ab47197ed579d54b1b6b87e","6ab2366e595f644ba24295f2","6ab236c1727beca33232db70"]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `""` |
| `telegram_greeting` | `""` |
| `line_greeting` | `""` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":true}`; use complete `memory_config.instructions` in canonical JSONC (3092 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"chief_of_staff"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Entity `Campaign` | `read` | [`base44/entities/Campaign.jsonc`](../base44/entities/Campaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Donation` | `read` | [`base44/entities/Donation.jsonc`](../base44/entities/Donation.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Recommendation` | `read`, `update` | [`base44/entities/Recommendation.jsonc`](../base44/entities/Recommendation.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `AgentDelegation` | `read`, `create`, `update` | [`base44/entities/AgentDelegation.jsonc`](../base44/entities/AgentDelegation.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `MissionBrief` | `read` | [`base44/entities/MissionBrief.jsonc`](../base44/entities/MissionBrief.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `FollowedCampaign` | `read` | [`base44/entities/FollowedCampaign.jsonc`](../base44/entities/FollowedCampaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Notification` | `read` | [`base44/entities/Notification.jsonc`](../base44/entities/Notification.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `InboxItem` | `read` | [`base44/entities/InboxItem.jsonc`](../base44/entities/InboxItem.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Function `generateIntelligence` | Generate a Mission Brief with today's priorities, risks, and predictions for the user's campaigns | [`base44/functions/generateIntelligence/entry.ts`](../base44/functions/generateIntelligence/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `sendCommunication` | Send an approved update or thank-you message to a campaign's supporters | [`base44/functions/sendCommunication/entry.ts`](../base44/functions/sendCommunication/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed donor psychology, persuasive messaging, social-content and trend research brief with provenance. Consult before substantial campaign or platform copywriting. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `manageAgentContentDraft` | Create/list/revise/cancel owner-scoped content proposals for IFund social posts, campaigns, campaign updates, blog articles, external post drafts, discussions, replies, and profiles. This tool does not publish or approve. | [`base44/functions/manageAgentContentDraft/entry.ts`](../base44/functions/manageAgentContentDraft/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getVerifiedIFundIntegrationContext` | Read current redacted provider routing and registration presence, with explicit platform-owner role checks. Read-only: does not authorize external account mutations or prove provider permissions. | [`base44/functions/getVerifiedIFundIntegrationContext/entry.ts`](../base44/functions/getVerifiedIFundIntegrationContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `discoverConnectionMethods` | Read-only provider route discovery by platform and subject; returns credential requirements, prerequisites and unknown capability states. Does not enable browser automation or modify accounts. | [`base44/functions/discoverConnectionMethods/entry.ts`](../base44/functions/discoverConnectionMethods/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `chief_of_staff` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Read the current owner’s campaigns, mission brief, notifications and open delegation records through the selected entity permissions. Load redacted account/integration context before describing connection state. Do not assume that a publicly readable campaign belongs to the caller.
3. Implement the selected Recommendation update operation as an owner-scoped accept/dismiss action. Preserve AgentDelegation create/read/update semantics and campaign IDs; never turn an assignment into a grant of authority.
4. Wire generateIntelligence only after the active-account, subscription, rate-limit and confirmed inference-budget gates pass. An unavailable provider leaves the previous evidence labeled with its age rather than fabricating a new briefing.
5. Wire routeAgentTask to its registered capability map; pass the concrete objective, source_agent, target_agent, owned campaign_id and minimal context. Persist the returned delegation/conversation references. A consequential specialist response remains needs_review until actual tool/provider evidence verifies it.
6. For messages, show exact content and recipient scope; call sendCommunication only after explicit owner approval. For campaign/social/profile changes create a draft through manageAgentContentDraft, leaving owner-only apply/publish outside the agent.
7. Connect the client through `https://interplanetaryfund.com/agents` → `Chief of Staff` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
8. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
9. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Ask for the top priorities of one owned campaign; verify every amount/date/status comes from current scoped records.
- Delegate a finance question and a story task; verify the destination name, campaign ID, persisted delegation and real specialist conversation. No admin-builder target may be accepted.
- Correct a campaign-specific preference, switch specialists, then return: the corrected preference applies only to that campaign. Another user cannot read it.
- Deny send without approval and deny handoff to another owner’s campaign. An interrupted specialist tool must not become completed.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/verify-agent-conversation-execution.mjs
node scripts/verify-agent-reasoning-coherence.mjs
node scripts/test-agent-chat-actions.mjs
```

**Triggers and dependencies:** Consumes mission/recommendation/activity output; no separate coordinator cron is granted by its “Always on” description. Admin inbox routing is a separate guarded background workflow.

**Rollback and next agent:** stop new `chief_of_staff` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-2"></a>

#### Agent 2 — Strategy (`strategy_agent`)

**Description:** Strategy Agent — shapes fundraising strategy and prioritizes where an organizer should focus energy across their campaigns. Always on.

**Implementation objective:** Produce source-backed priorities and fundraising plans from the member’s own portfolio, goals, deadlines and AI-profile constraints.

**Canonical definition:** [`base44/agents/strategy_agent.jsonc`](../base44/agents/strategy_agent.jsonc). Source SHA-256 at this inventory: `acb83a017c3a9eda46997a0853e7b3d32b209d0b2c3df4facb75e5dae2523056`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skill:** [`.agents/skills/ifund-strategy/SKILL.md`](../.agents/skills/ifund-strategy/SKILL.md). Read its referenced complete role guide where present, plus [`.agents/skills/ifund-content-writes/SKILL.md`](../.agents/skills/ifund-content-writes/SKILL.md) for owner context/drafts. Do not install engineering SKILL.md as a remote conversational skill.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Strategy Agent — shapes fundraising strategy and prioritizes where an organizer should focus energy across their campaigns. Always on."` |
| `instructions` | Use full `instructions` in [`base44/agents/strategy_agent.jsonc`](../base44/agents/strategy_agent.jsonc); 8580 characters. Do not truncate or replace with role description. |
| `tool_configs` | 7 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `["connections-webproxy"]` |
| `selected_workspace_skill_ids` | `["6ab46f2180895ff2754f1d03","6ab4798715c82e0e88c70efe","6ab474e9c2b6b184aa9b049f","6ab2366e595f644ba24295f2"]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `""` |
| `telegram_greeting` | `""` |
| `line_greeting` | `""` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":true}`; use complete `memory_config.instructions` in canonical JSONC (2917 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"strategy_agent"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Entity `Campaign` | `read` | [`base44/entities/Campaign.jsonc`](../base44/entities/Campaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Recommendation` | `read` | [`base44/entities/Recommendation.jsonc`](../base44/entities/Recommendation.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Function `generateIntelligence` | Generate a Mission Brief to inform strategic priorities | [`base44/functions/generateIntelligence/entry.ts`](../base44/functions/generateIntelligence/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed human fundraising psychology, persuasive writing, community engagement and social trends brief. Apply when producing public-facing text. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `manageAgentContentDraft` | Create/list/revise/cancel owner-scoped content proposals for IFund social posts, campaigns, campaign updates, blog articles, external post drafts, discussions, replies, and profiles. This tool does not publish or approve. | [`base44/functions/manageAgentContentDraft/entry.ts`](../base44/functions/manageAgentContentDraft/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `strategy_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Read owned Campaign and Recommendation records and the latest allowed account context. Capture ai_profile primary_goal, beneficiary, tone, never_change, avoid_words and priority before planning.
3. Wire generateIntelligence with explicit invocation intent and current budget/rate limits. Keep predictions labeled with evidence and uncertainty; do not infer other members’ conversion rates.
4. Use getWritingResearchBrief for substantial public-facing text and retain the source date. A missing research brief is not permission to fabricate citations.
5. Create campaign_changes or other supported drafts only through manageAgentContentDraft. Do not register saveCampaign or direct Campaign write operations when they are absent from tool_configs.
6. Keep accepted/dismissed recommendation handling with the actual permitted boundary; reading a recommendation does not authorize executing it.
7. Connect the client through `https://interplanetaryfund.com/agents` → `Strategy` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
8. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
9. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Use two owned campaigns with different goals/deadlines and verify priorities cite the correct campaign.
- Supply never_change/avoid_words constraints and test generated proposals respect them.
- Verify missing data and a 429/provider-budget failure produce an honest response without retry loops.
- Create one proposal, confirm the public campaign is unchanged until owner review; deny a different owner’s campaign ID.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/verify-agent-training-expansion.mjs
node scripts/verify-agent-write-capabilities.mjs
```

**Triggers and dependencies:** May consume Campaign Protocol and Feature Discovery outputs; no strategy-specific scheduled chat agent is configured.

**Rollback and next agent:** stop new `strategy_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-3"></a>

#### Agent 3 — Growth (`growth_agent`)

**Description:** Growth Agent — finds audience and donation growth opportunities by analyzing donations and connected platforms. Always on.

**Implementation objective:** Analyze actual donation momentum, recurring support and verified provider capabilities to suggest ethical growth actions.

**Canonical definition:** [`base44/agents/growth_agent.jsonc`](../base44/agents/growth_agent.jsonc). Source SHA-256 at this inventory: `0757986693590bd4b467406139987101efcc225a7cf59a8fa895af08e9da09c4`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skill:** [`.agents/skills/ifund-growth/SKILL.md`](../.agents/skills/ifund-growth/SKILL.md). Read its referenced complete role guide where present, plus [`.agents/skills/ifund-content-writes/SKILL.md`](../.agents/skills/ifund-content-writes/SKILL.md) for owner context/drafts. Do not install engineering SKILL.md as a remote conversational skill.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Growth Agent — finds audience and donation growth opportunities by analyzing donations and connected platforms. Always on."` |
| `instructions` | Use full `instructions` in [`base44/agents/growth_agent.jsonc`](../base44/agents/growth_agent.jsonc); 8498 characters. Do not truncate or replace with role description. |
| `tool_configs` | 7 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `["connections-webproxy"]` |
| `selected_workspace_skill_ids` | `["6ab4798715c82e0e88c70efe","6ab46f2180895ff2754f1d03","6ab474e9c2b6b184aa9b049f"]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `""` |
| `telegram_greeting` | `""` |
| `line_greeting` | `""` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":true}`; use complete `memory_config.instructions` in canonical JSONC (4233 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"growth_agent"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Entity `Campaign` | `read` | [`base44/entities/Campaign.jsonc`](../base44/entities/Campaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Donation` | `read` | [`base44/entities/Donation.jsonc`](../base44/entities/Donation.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `PlatformConnection` | `read` | [`base44/entities/PlatformConnection.jsonc`](../base44/entities/PlatformConnection.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed donor psychology, persuasive messaging, social-content and trend research brief with provenance. Consult before substantial campaign or platform copywriting. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `manageAgentContentDraft` | Create/list/revise/cancel owner-scoped content proposals for IFund social posts, campaigns, campaign updates, blog articles, external post drafts, discussions, replies, and profiles. This tool does not publish or approve. | [`base44/functions/manageAgentContentDraft/entry.ts`](../base44/functions/manageAgentContentDraft/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `growth_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Wire only the selected Campaign, Donation and PlatformConnection read operations with backend owner/RLS checks. Public campaign visibility must not expose private donations or raw connection credentials.
3. Load getAgentAccountContext and the research brief before suggesting provider-specific channels. Distinguish configured, disconnected, verified, stale and manual-only capabilities.
4. Keep external observations currency-specific and separate from IFund’s withdrawable balance. Do not treat a creator-entered external total as a donation record.
5. Use manageAgentContentDraft for approved-scope growth proposals; no direct publish/send operation is added just because a provider has a configured token.
6. Return campaign-specific suggestions grounded in current evidence, not guaranteed fundraising outcomes, purchased donor lists or manipulative urgency.
7. Connect the client through `https://interplanetaryfund.com/agents` → `Growth` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
8. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
9. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Include verified and unverified donations and ensure growth/finance claims retain provenance.
- Configure but do not verify a provider: the agent must not report it connected or promise posting.
- Create a draft targeted to an owned campaign/connection; deny destination substitution during revision.
- Disconnect or revoke a grant before execution; no queued suggestion may use the old permission.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/verify-agent-write-capabilities.mjs
node scripts/verify-request-triggered-external-sync.mjs
```

**Triggers and dependencies:** Related operational workflows are Connection Sync Engine, External Feed Mirroring and Social Media Autopilot. Their separate authorization and activation do not follow from installing Growth.

**Rollback and next agent:** stop new `growth_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-4"></a>

#### Agent 4 — Communications (`communications_agent`)

**Description:** Communications Agent — drafts and sends updates and thank-you messages to supporters. Always on, but never sends without the user's approval.

**Implementation objective:** Draft campaign updates and supporter thank-you messages, with explicit owner review and truthful per-channel delivery outcomes.

**Canonical definition:** [`base44/agents/communications_agent.jsonc`](../base44/agents/communications_agent.jsonc). Source SHA-256 at this inventory: `37097ccd666016fa5d1b102a1cd82ed85837b17e639b1b941ffd72d7cac9012b`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skill:** [`.agents/skills/ifund-communications/SKILL.md`](../.agents/skills/ifund-communications/SKILL.md). Read its referenced complete role guide where present, plus [`.agents/skills/ifund-content-writes/SKILL.md`](../.agents/skills/ifund-content-writes/SKILL.md) for owner context/drafts. Do not install engineering SKILL.md as a remote conversational skill.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Communications Agent — drafts and sends updates and thank-you messages to supporters. Always on, but never sends without the user's approval."` |
| `instructions` | Use full `instructions` in [`base44/agents/communications_agent.jsonc`](../base44/agents/communications_agent.jsonc); 8183 characters. Do not truncate or replace with role description. |
| `tool_configs` | 7 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `["connections-webproxy"]` |
| `selected_workspace_skill_ids` | `["6ab4798715c82e0e88c70efe","6ab46f2180895ff2754f1d03","6ab4723f7fc2b06c5f3ab8a7","6ab475f0f3fd429b0510e3ce","6ab236c1727beca33232db70","6ab474e9c2b6b184aa9b049f","6ab2366e595f644ba24295f2","6ab4779013dfc91ef024f384","6ab236a20f89e75829fa0eec"]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `""` |
| `telegram_greeting` | `""` |
| `line_greeting` | `""` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":true}`; use complete `memory_config.instructions` in canonical JSONC (2917 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"communications_agent"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Entity `Campaign` | `read` | [`base44/entities/Campaign.jsonc`](../base44/entities/Campaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Message` | `read` | [`base44/entities/Message.jsonc`](../base44/entities/Message.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Function `sendCommunication` | Send an approved update or thank-you message to a campaign's supporters | [`base44/functions/sendCommunication/entry.ts`](../base44/functions/sendCommunication/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed donor psychology, persuasive messaging, social-content and trend research brief with provenance. Consult before substantial campaign or platform copywriting. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `manageAgentContentDraft` | Create/list/revise/cancel owner-scoped content proposals for IFund social posts, campaigns, campaign updates, blog articles, external post drafts, discussions, replies, and profiles. This tool does not publish or approve. | [`base44/functions/manageAgentContentDraft/entry.ts`](../base44/functions/manageAgentContentDraft/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `communications_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Wire owned Campaign and Message reads exactly as selected. Never supply the model with another campaign’s donor list or hidden private recipient fields.
3. Load current account context and source-backed writing guidance; prepare exact subject/content, campaign, audience and channels before asking for approval.
4. Use manageAgentContentDraft for reviewable social/campaign/email-adjacent content types supported by that function. Do not invent an unsupported email draft kind.
5. Call sendCommunication only for the explicitly approved content and recipient scope. Preserve backend preference/opt-out, channel, ownership and rate-limit checks and deduplication evidence.
6. Separate email/in-app delivery from public IFund posts and external distribution. A manual provider handoff or accepted send request is not proof of delivery.
7. Connect the client through `https://interplanetaryfund.com/agents` → `Communications` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
8. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
9. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Draft a thank-you and verify nothing is sent before approval.
- Approve a bounded synthetic recipient fixture; inspect actual permitted recipient count/channel results, including opted-out recipients.
- Deny a campaign ID owned by another user and a request to broadcast to all IFund users.
- Test duplicate approval, provider timeout, failure and partial channel delivery; preserve uncertain/partial results rather than claiming sent.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/verify-agent-write-capabilities.mjs
node scripts/test-agent-chat-actions.mjs
```

**Triggers and dependencies:** Volunteer Welcome Follow-up and approved campaign updates can produce communications through their own backend gates. Email ingress is inbound evidence, not automatic reply authorization.

**Rollback and next agent:** stop new `communications_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-5"></a>

#### Agent 5 — Story (`story_agent`)

**Description:** Story Agent — helps organizers tell their campaign's story authentically and effectively, and guides all campaign imagery in the Interplanetary Fund signature style. Always on.

**Implementation objective:** Prepare authentic campaign narrative and image guidance while preserving facts, tone and owner constraints.

**Canonical definition:** [`base44/agents/story_agent.jsonc`](../base44/agents/story_agent.jsonc). Source SHA-256 at this inventory: `1436b2557ba1b88dc9c7c7dffc3e4e2312d033af2b45aed8f974df5ab67e6f10`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skill:** [`.agents/skills/ifund-story/SKILL.md`](../.agents/skills/ifund-story/SKILL.md). Read its referenced complete role guide where present, plus [`.agents/skills/ifund-content-writes/SKILL.md`](../.agents/skills/ifund-content-writes/SKILL.md) for owner context/drafts. Do not install engineering SKILL.md as a remote conversational skill.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Story Agent — helps organizers tell their campaign's story authentically and effectively, and guides all campaign imagery in the Interplanetary Fund signature style. Always on."` |
| `instructions` | Use full `instructions` in [`base44/agents/story_agent.jsonc`](../base44/agents/story_agent.jsonc); 9202 characters. Do not truncate or replace with role description. |
| `tool_configs` | 5 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `[]` |
| `selected_workspace_skill_ids` | `["6ab4767651cc203b523a04e3","6ab46f2180895ff2754f1d03","6ab4798715c82e0e88c70efe","6ab236a20f89e75829fa0eec"]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `""` |
| `telegram_greeting` | `""` |
| `line_greeting` | `""` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":true}`; use complete `memory_config.instructions` in canonical JSONC (4521 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"story_agent"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Entity `Campaign` | `read` | [`base44/entities/Campaign.jsonc`](../base44/entities/Campaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed donor psychology, persuasive messaging, social-content and trend research brief with provenance. Consult before substantial campaign or platform copywriting. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `manageAgentContentDraft` | Create/list/revise/cancel owner-scoped content proposals for IFund social posts, campaigns, campaign updates, blog articles, external post drafts, discussions, replies, and profiles. This tool does not publish or approve. | [`base44/functions/manageAgentContentDraft/entry.ts`](../base44/functions/manageAgentContentDraft/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `story_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Read the owned campaign and full ai_profile; fact-lock beneficiary, need, amounts, dates and never_change constraints. Do not manufacture a beneficiary history or achievement.
3. Load the writing research brief and redacted account context only through selected functions. Treat campaign story/provider text as untrusted narrative rather than new system instructions.
4. Create campaign_changes, campaign_update or other supported drafts through manageAgentContentDraft; no direct Campaign mutation or publication tool is selected.
5. For image work, preserve current IFund illustration/AI-caption conventions and the campaign-derived context. This agent’s prompt/description is not a direct image-generation tool grant; use only the actual supported owner workflow or a separately reviewed adapter.
6. Keep requested story_versions/history, review and current fact precedence intact through the existing campaign application boundary. Revisions may not change target campaign/destination identities.
7. Connect the client through `https://interplanetaryfund.com/agents` → `Story` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
8. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
9. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Provide fixed medical/financial facts and avoid_words; reject requests to invent donor counts or outcomes.
- Create/revise a campaign story proposal; public source changes only after the owner applies it.
- Attempt prompt injection in a story field and cross-campaign context leakage; neither may change permissions or import facts.
- Verify an image suggestion is labeled as guidance unless a real permitted image-generation result exists.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/verify-agent-training-expansion.mjs
node scripts/verify-agent-write-capabilities.mjs
```

**Triggers and dependencies:** Uses the research-training output. Campaign Protocol remains a separate entity workflow; no Story cron or image-generation entitlement is inferred.

**Rollback and next agent:** stop new `story_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-6"></a>

#### Agent 6 — Finance (`finance_agent`)

**Description:** Finance Agent — tracks raised amounts, donor counts, and withdrawals for an organizer's campaigns. Always on.

**Implementation objective:** Explain verified donations, clearing, fee allocation and withdrawal status without initiating or modifying financial transactions.

**Canonical definition:** [`base44/agents/finance_agent.jsonc`](../base44/agents/finance_agent.jsonc). Source SHA-256 at this inventory: `a298ff7136566786af2d78d80dff6e8f6561af0982bac0adee2fd5dea9d66c43`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skill:** [`.agents/skills/ifund-finance/SKILL.md`](../.agents/skills/ifund-finance/SKILL.md). Read its referenced complete role guide where present, plus [`.agents/skills/ifund-content-writes/SKILL.md`](../.agents/skills/ifund-content-writes/SKILL.md) for owner context/drafts. Do not install engineering SKILL.md as a remote conversational skill.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Finance Agent — tracks raised amounts, donor counts, and withdrawals for an organizer's campaigns. Always on."` |
| `instructions` | Use full `instructions` in [`base44/agents/finance_agent.jsonc`](../base44/agents/finance_agent.jsonc); 7487 characters. Do not truncate or replace with role description. |
| `tool_configs` | 6 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `[]` |
| `selected_workspace_skill_ids` | `["6ab4798715c82e0e88c70efe","6ab46f2180895ff2754f1d03","6ab47362e1c4cb9cb4d225c7","6ab2366e595f644ba24295f2","6ab236c1727beca33232db70","6ab236a20f89e75829fa0eec","6ab474e9c2b6b184aa9b049f"]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `null` |
| `telegram_greeting` | `null` |
| `line_greeting` | `null` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":true}`; use complete `memory_config.instructions` in canonical JSONC (2917 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"finance_agent"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Entity `Campaign` | `read` | [`base44/entities/Campaign.jsonc`](../base44/entities/Campaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Donation` | `read` | [`base44/entities/Donation.jsonc`](../base44/entities/Donation.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Withdrawal` | `read` | [`base44/entities/Withdrawal.jsonc`](../base44/entities/Withdrawal.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed human fundraising psychology, persuasive writing, community engagement and social trends brief. Apply when producing public-facing text. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `finance_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Wire selected Campaign, Donation and Withdrawal reads through their actual RLS/owner context. A campaign owner is not automatically authorized to list every donor’s private records; preserve the current backend’s permitted view.
3. Reconcile current verified, cleared, reserved/in-flight and paid state using the authoritative financial implementation. Never calculate withdrawable money solely from Campaign.raised_amount.
4. Use base44/shared/fees.js and actual transaction/provider records when explaining charges. Preserve historical transaction allocations and currency separation; do not hard-code a historical skill-guide example as current pricing.
5. External owner-reported totals are informational and non-withdrawable. Provider settlement proof, ledger credit and payout initiation remain separate protected interfaces outside this agent.
6. Keep Finance’s exact selected function list; do not add manageAgentContentDraft, requestWithdrawal, settlement mutation or transfer APIs simply because other specialists have them. Report unresolved holds/provider states accurately and refer the owner to the existing financial workflow.
7. Connect the client through `https://interplanetaryfund.com/agents` → `Finance` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
8. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
9. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Test unverified/uncleared/cleared/reserved/paid/refunded fixtures and verify no double-counting or overstatement.
- Compare each displayed fee explanation with the current shared fee functions and recorded provider values.
- Test two currencies and owner-reported external funds; no mixed amount or fabricated withdrawable balance.
- Attempt a withdrawal status change, transfer request, other-user read and self-asserted admin prompt; no mutation or access escalation is permitted.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/test-financial-integrity.mjs
node scripts/test-fee-calc.mjs
node scripts/verify-agent-write-capabilities.mjs
```

**Triggers and dependencies:** PayPal Holding Settlement Reconciliation is an independent protected backend workflow. Finance may explain its verified result but cannot invoke it as an unselected tool.

**Rollback and next agent:** stop new `finance_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-7"></a>

#### Agent 7 — Outreach (`outreach_agent`)

**Description:** Outreach Agent — always-on owner of Interplanetary Fund platform-owned marketing/outreach accounts and subscriber-authorized campaign outreach across external platforms.

**Implementation objective:** Explain recommendations and verified outreach activity, prepare owner-reviewed content, and assist only through selected supported provider tools.

**Canonical definition:** [`base44/agents/outreach_agent.jsonc`](../base44/agents/outreach_agent.jsonc). Source SHA-256 at this inventory: `f6c60968fcf1771ea2ad64265469364cb82de33fabbbdb6c5665e8c8162b1caa`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skill:** [`.agents/skills/ifund-outreach/SKILL.md`](../.agents/skills/ifund-outreach/SKILL.md). Read its referenced complete role guide where present, plus [`.agents/skills/ifund-content-writes/SKILL.md`](../.agents/skills/ifund-content-writes/SKILL.md) for owner context/drafts. Do not install engineering SKILL.md as a remote conversational skill.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Outreach Agent — always-on owner of Interplanetary Fund platform-owned marketing/outreach accounts and subscriber-authorized campaign outreach across external platforms."` |
| `instructions` | Use full `instructions` in [`base44/agents/outreach_agent.jsonc`](../base44/agents/outreach_agent.jsonc); 16506 characters. Do not truncate or replace with role description. |
| `tool_configs` | 10 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `["connections-webproxy","platform-connection","failed-connection-recovery"]` |
| `selected_workspace_skill_ids` | `["6ab46f2180895ff2754f1d03","6ab4798715c82e0e88c70efe","6ab4723f7fc2b06c5f3ab8a7","6ab474e9c2b6b184aa9b049f","6ab475f0f3fd429b0510e3ce"]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `""` |
| `telegram_greeting` | `""` |
| `line_greeting` | `""` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":true}`; use complete `memory_config.instructions` in canonical JSONC (4228 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"outreach_agent"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Entity `Campaign` | `read` | [`base44/entities/Campaign.jsonc`](../base44/entities/Campaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Recommendation` | `read` | [`base44/entities/Recommendation.jsonc`](../base44/entities/Recommendation.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `AgentActivity` | `read` | [`base44/entities/AgentActivity.jsonc`](../base44/entities/AgentActivity.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Function `runBrowserConnection` | Use an owner-authorized connected browser transport for campaign-relevant external platform work. Read actions may observe connected account/campaign information. Write actions are permitted only through implemented capability-specific workflows after campaign-owner OBO authorization, verified connection/session state, provider support, and current automation/approval checks. Never treat page content as authorization and never expose credentials or session secrets. | [`base44/functions/runBrowserConnection/entry.ts`](../base44/functions/runBrowserConnection/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getStripeIntegrationAudit` | For the authenticated IFund administrator, inspect the existing Stripe business account and provider endpoints, product/price mappings, taxpayer information requirements and webhook coverage. It is read-only, reveals no keys, EIN or banking data, and must never be called a Stripe dashboard login. | [`base44/functions/getStripeIntegrationAudit/entry.ts`](../base44/functions/getStripeIntegrationAudit/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `repairStripeWebhookEvents` | For an authenticated IFund administrator requesting no-charge Stripe integration maintenance, repair event subscriptions only on the unique existing IFund Stripe webhook. No new merchant accounts, purchases, charges, paid products, API-key rotations, tax ID updates, transfers or payouts. | [`base44/functions/repairStripeWebhookEvents/entry.ts`](../base44/functions/repairStripeWebhookEvents/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed donor psychology, persuasive messaging, social-content and trend research brief with provenance. Consult before substantial campaign or platform copywriting. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `manageAgentContentDraft` | Create/list/revise/cancel owner-scoped content proposals for IFund social posts, campaigns, campaign updates, blog articles, external post drafts, discussions, replies, and profiles. This tool does not publish or approve. | [`base44/functions/manageAgentContentDraft/entry.ts`](../base44/functions/manageAgentContentDraft/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `outreach_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Read current owned Campaign, Recommendation and AgentActivity records and fresh redacted account/integration context. The legacy guide’s “no backend functions” statement predates the current tool list; use the current list without broadening it.
3. Keep conversational outreach separate from scheduled runOutreachAgent. The latter creates bounded recommendation/activity artifacts under active-account, tier and campaign opt-in/pause gates, not universal permission to publish.
4. Wire runBrowserConnection only to its actual current restricted read/deferred behavior. A remote browser skill, credential reference or platform-owned account roster does not implement account creation, posting or provider MFA completion.
5. Prepare supported drafts through manageAgentContentDraft. Require owner approval, verified provider capability and actual publishing receipts through the canonical publisher for any external action.
6. Current getStripeIntegrationAudit and repairStripeWebhookEvents tools are admin-gated by their backends despite appearing on Outreach. Preserve denial for ordinary users; review whether to remove those selections in a separately scoped permission change. Never weaken the admin check to make a tool work.
7. For platform-owned channels require verified platform-owner delegation distinct from a member’s OBO grant. Optional Buffer remains disconnected/unverified until securely configured and actual safe API behavior is tested; no new adapter is activated by this runbook.
8. Connect the client through `https://interplanetaryfund.com/agents` → `Outreach` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
9. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
10. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Inspect opt-in, paused and ineligible-subscription fixtures; scheduled recommendations must not bypass those gates.
- Distinguish proposed, approved, manual, published and uncertain activity from authoritative receipts.
- Ordinary users must receive denial from both selected Stripe admin functions and cannot read platform-owned credentials.
- Revoked provider consent, unsupported browser writes and another owner’s campaign must stop execution; retries must not duplicate public posts.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/verify-agent-write-capabilities.mjs
node scripts/verify-request-triggered-external-sync.mjs
```

**Triggers and dependencies:** AI Outreach Agent, IFund Official Social Editor, Platform Account Steward and Social Media Autopilot are separately documented background functions. They are not additional chat identities or implied chat-tool grants.

**Rollback and next agent:** stop new `outreach_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-8"></a>

#### Agent 8 — Connection Discovery (`connection_discovery_agent`)

**Description:** Connection Discovery Agent — researches, verifies, and classifies external fundraising/social platform capabilities so IFund knows exactly how to connect to each provider and what actions are possible.

**Implementation objective:** Research and classify actual provider connection capabilities with sources, limitations and truthful verification state.

**Canonical definition:** [`base44/agents/connection_discovery_agent.jsonc`](../base44/agents/connection_discovery_agent.jsonc). Source SHA-256 at this inventory: `91bf743522f36e43d8bbb33758459a29be9451f2eb290a16fe9a75aaa2ad572d`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skills:** no dedicated legacy role package is present; use the source instructions, shared content skill and connection authority contract. Do not fabricate a selected remote skill body.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Connection Discovery Agent — researches, verifies, and classifies external fundraising/social platform capabilities so IFund knows exactly how to connect to each provider and what actions are possible."` |
| `instructions` | Use full `instructions` in [`base44/agents/connection_discovery_agent.jsonc`](../base44/agents/connection_discovery_agent.jsonc); 12226 characters. Do not truncate or replace with role description. |
| `tool_configs` | 8 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `[]` |
| `selected_workspace_skill_ids` | `[]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `""` |
| `telegram_greeting` | `""` |
| `line_greeting` | `""` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":false}`; use complete `memory_config.instructions` in canonical JSONC (595 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"connection_discovery_agent"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Entity `FundraisingProviderCapability` | `read`, `create`, `update` | [`base44/entities/FundraisingProviderCapability.jsonc`](../base44/entities/FundraisingProviderCapability.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `PlatformConnection` | `read` | [`base44/entities/PlatformConnection.jsonc`](../base44/entities/PlatformConnection.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `Campaign` | `read` | [`base44/entities/Campaign.jsonc`](../base44/entities/Campaign.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Entity `AgentActivity` | `read` | [`base44/entities/AgentActivity.jsonc`](../base44/entities/AgentActivity.jsonc); inspect current RLS and test each allowed/denied operation in caller context |
| Function `listFundraisingProviderCapabilities` | Get current canonical provider capabilities to compare against research findings | [`base44/functions/listFundraisingProviderCapabilities/entry.ts`](../base44/functions/listFundraisingProviderCapabilities/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed human fundraising psychology, persuasive writing, community engagement and social trends brief. Apply when producing public-facing text. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `connection_discovery_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Use current FundraisingProviderCapability selections and owner-scoped connection/activity/campaign reads. Apply exactly selected read/create/update operations, with backend validation of who may persist provider evidence.
3. Wire listFundraisingProviderCapabilities and discoverConnectionMethods to their existing input validation and provider registry. Preserve the distinction between provider-documented possibility and a successful live IFund capability test.
4. Use getVerifiedIFundIntegrationContext for approved origins/callbacks/provider facts where selected. Unknown or stale configuration must stay unknown; never invent app registrations, callback URLs or granted scopes.
5. Preserve Discovery’s cross-conversation-context false setting. Its long-term capability knowledge must not ingest other users’ private account sessions or credentials.
6. There is no dedicated legacy Discovery skill package in this tree. Use its complete canonical instructions plus the shared content/connection contracts, and preserve its selected remote skills pending remote reconciliation. Research must not silently register services, spend money or send verification posts.
7. Connect the client through `https://interplanetaryfund.com/agents` → `Discovery` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
8. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
9. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Research a provider with only manual/import support; report that limitation rather than a working OAuth API.
- Record source-backed evidence with date/confidence; lack of a live grant cannot set provider-connected status.
- Test malformed provider URLs/input, cross-owner connection reads and injection in provider pages.
- Verify selecting Discovery does not expose another specialist’s conversation context or widen schema write authority.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/verify-managed-connections-contract.mjs
node scripts/verify-agent-runtime-dependencies.mjs
```

**Triggers and dependencies:** Integration Health Check and Feature Discovery on Completion may consume capability findings; they need separate authenticated dispatch and actual backend evidence.

**Rollback and next agent:** stop new `connection_discovery_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-9"></a>

#### Agent 9 — Managed Connections (`managed_connection_agent`)

**Description:** Managed Connections — a subscription-gated connection specialist that helps an authorized IFund user connect, verify, repair, and resume eligible external accounts without bypassing provider-required security or consent.

**Implementation objective:** Help an eligible member connect, repair and reauthorize their own accounts through current supported transports and explicit OBO authority.

**Canonical definition:** [`base44/agents/managed_connection_agent.jsonc`](../base44/agents/managed_connection_agent.jsonc). Source SHA-256 at this inventory: `a55aeaf89a1faa08940eaf0314f43c2452361bd2b321f236dbb255cdf1f0badc`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skills:** no dedicated legacy role package is present; use the source instructions, shared content skill and connection authority contract. Do not fabricate a selected remote skill body.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `description` | `"Managed Connections — a subscription-gated connection specialist that helps an authorized IFund user connect, verify, repair, and resume eligible external accounts without bypassing provider-required security or consent."` |
| `instructions` | Use full `instructions` in [`base44/agents/managed_connection_agent.jsonc`](../base44/agents/managed_connection_agent.jsonc); 10311 characters. Do not truncate or replace with role description. |
| `tool_configs` | 8 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `[]` |
| `selected_workspace_skill_ids` | `[]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `null` |
| `telegram_greeting` | `null` |
| `line_greeting` | `null` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":true}`; use complete `memory_config.instructions` in canonical JSONC (401 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |
| `name` | `"managed_connection_agent"` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Function `requestManagedConnectionAction` | Server-authoritative Managed Connections command boundary. Use for connect, create_account, repair, and reauthorize requests. It enforces paid entitlement, unified OBO authorization, ownership, route truth, and delegation state. | [`base44/functions/requestManagedConnectionAction/entry.ts`](../base44/functions/requestManagedConnectionAction/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `listConnections` | Read the authenticated user's redacted connection status without exposing stored secrets. | [`base44/functions/listConnections/entry.ts`](../base44/functions/listConnections/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `resolveConnectionStatus` | Read canonical connection lifecycle and verified capability state for an owned connection. | [`base44/functions/resolveConnectionStatus/entry.ts`](../base44/functions/resolveConnectionStatus/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getWritingResearchBrief` | Read the latest weekly source-backed human fundraising psychology, persuasive writing, community engagement and social trends brief. Apply when producing public-facing text. | [`base44/functions/getWritingResearchBrief/entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getAgentAccountContext` | Read the signed-in member's redacted verified connections, campaign focus, IFund and external post history, followed campaigns, groups, agent work, and draft summaries. Use for current account questions; no secrets. | [`base44/functions/getAgentAccountContext/entry.ts`](../base44/functions/getAgentAccountContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `routeAgentTask` | Dispatch to a specialist agent with real owner-scoped execution. mode=dispatch: source_agent, capability, target_agent, objective, optional context_summary/campaign_id. mode=status: delegation_id. Use only allowed capability routes; do not claim a queued task is completed. | [`base44/functions/routeAgentTask/entry.ts`](../base44/functions/routeAgentTask/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `getVerifiedIFundIntegrationContext` | Read current redacted provider routing and registration presence, with explicit platform-owner role checks. Read-only: does not authorize external account mutations or prove provider permissions. | [`base44/functions/getVerifiedIFundIntegrationContext/entry.ts`](../base44/functions/getVerifiedIFundIntegrationContext/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `discoverConnectionMethods` | Read-only provider route discovery by platform and subject; returns credential requirements, prerequisites and unknown capability states. Does not enable browser automation or modify accounts. | [`base44/functions/discoverConnectionMethods/entry.ts`](../base44/functions/discoverConnectionMethods/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `managed_connection_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Enforce the managed_connections feature flag and current active plan level >=2 on the backend, not only the selector. Require current unified OBO permission/version and connection-specific current grants before delegated repair.
3. Wire requestManagedConnectionAction with exact actions connect/create_account/repair/reauthorize, platform, owned campaign ID and owned connection ID where required. Preserve persisted recipe/transport discovery and valid provider policy.
4. Use listConnections/resolveConnectionStatus and selected account-context functions to show redacted actual state. Credentials are supplied only via a protected connection form or provider sign-in; do not collect passwords/tokens/MFA codes in chat.
5. Use supported oauth/token/webhook/public_browser/authenticated_browser transport evidence. Account creation currently requires the official provider sign-up/sign-in path; a waiting_user/create_account result is not a created account.
6. After provider completion verify an API read/webhook or explicitly approved safe publish separately for each claimed capability. Saving credentials or owner acknowledgement must leave the connection unverified.
7. Resume the existing delegation/continuation rather than creating duplicate tasks on every refresh. On disconnect/revoke/expiry cancel or deny queued operations and preserve the backend’s waiting/blocked state. No dedicated legacy role skill package exists; use canonical instructions and shared contracts.
8. Connect the client through `https://interplanetaryfund.com/agents` → `Managed Connections` (verify current route and eligible session). Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
9. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
10. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Compare plan levels 1 and 2, expired subscription, disabled flag and absent/stale OBO grants; backend denies ineligible requests.
- Try another user’s connection or campaign, wrong provider and repaired connection after revocation; all must fail before provider calls.
- Complete one supported fixture connection end-to-end; only a real provider result sets verified capabilities.
- Test MFA/manual/unavailable transports, cancelled continuation and repeated resume; no manufactured connected state or duplicate delegation.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/test-managed-agent-runtime.mjs
node scripts/verify-managed-connections-contract.mjs
node scripts/verify-connection-lifecycle-contract.mjs
```

**Triggers and dependencies:** Connection Sync Engine and Campaign Sync workflows use their own scopes; installation must not restore prohibited scheduled external-fund imports.

**Rollback and next agent:** stop new `managed_connection_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

<a id="agent-implementation-10"></a>

#### Agent 10 — Admin Builder Coordinator (`admin_builder_agent`)

**Description:** Admin Builder Coordinator — private super-admin build-task intake, status and development work handoff; no unverified code execution.

**Implementation objective:** Accept bounded super-admin build/incident assignments and preserve reviewed development work without pretending queueing is implementation or release.

**Canonical definition:** [`base44/agents/admin_builder_agent.jsonc`](../base44/agents/admin_builder_agent.jsonc). Source SHA-256 at this inventory: `ee89e011d44802b4c5b0fed98f024338a11a5829ce5f4a121822b95e5203c713`. Use the entire file as the baseline; the following inventory is not a replacement deployment payload.

**Engineering skill:** [`.agents/skills/ifund-admin-builder/SKILL.md`](../.agents/skills/ifund-admin-builder/SKILL.md). Read its referenced complete role guide where present, plus [`.agents/skills/ifund-content-writes/SKILL.md`](../.agents/skills/ifund-content-writes/SKILL.md) for owner context/drafts. Do not install engineering SKILL.md as a remote conversational skill.

**Selections — every current top-level field**

| Field | Exact source selection or full-text source |
| --- | --- |
| `name` | `"admin_builder_agent"` |
| `description` | `"Admin Builder Coordinator — private super-admin build-task intake, status and development work handoff; no unverified code execution."` |
| `instructions` | Use full `instructions` in [`base44/agents/admin_builder_agent.jsonc`](../base44/agents/admin_builder_agent.jsonc); 2663 characters. Do not truncate or replace with role description. |
| `tool_configs` | 2 exact tools listed below; retain descriptions and operations from the canonical array. |
| `context_files` | `[]` |
| `app_user_connector_configs` | `[]` |
| `selected_skill_names` | `[]` |
| `selected_workspace_skill_ids` | `[]` |
| `model` | `"automatic"` |
| `whatsapp_greeting` | `""` |
| `telegram_greeting` | `""` |
| `memory_config` | `{"enabled":true,"scope":"both","include_other_conversation_context":false}`; use complete `memory_config.instructions` in canonical JSONC (180 characters). |
| `voice_config` | `{"voice_id":null}` |
| `emails_settings` | `null` |
| `allow_anonymous_access` | `false` |

**Tool wiring — no other tools are granted**

| Tool | Selected operation/description | Implementation and authorization source |
| --- | --- | --- |
| Function `managePlatformIncidents` | Super-admin-only platform-wide frontend error investigation and fix planning; list, save_plan, reject and approve explicit administrator-reviewed incident fixes. Super-admin approval creates a task; backend dispatches a real Base44 app-builder change turn only when authorized backend credentials and credits are explicitly enabled. It never confirms deployment just from a dispatch. | [`base44/functions/managePlatformIncidents/entry.ts`](../base44/functions/managePlatformIncidents/entry.ts); preserve parser, imported guards, owner checks and error contract |
| Function `manageAdminBuilderWork` | Super-admin-only backend: list/queue audited development assignments. Queues work, does NOT edit code or deploy. | [`base44/functions/manageAdminBuilderWork/entry.ts`](../base44/functions/manageAdminBuilderWork/entry.ts); preserve parser, imported guards, owner checks and error contract |

**Create, implement and connect this agent**

1. Select the existing `admin_builder_agent` definition in the verified Base44 app. If absent, create only this stable identity using its canonical JSONC after preserving remote skill/configuration inventory. Do not bulk-sync the entire app or copy another agent’s permissions. Preserve model/channel/memory settings above and reconcile every selected remote skill ID.
2. Keep this identity outside the ordinary nine-agent selector. Use the signed-in Admin tools workspace and server-verified role plus current owner allowlist. Never copy owner email/recovery details into prompts or user-facing docs.
3. Wire only managePlatformIncidents and manageAdminBuilderWork. Do not add direct entity writes, shell, deployment, credential-management or general workspace connector tools. Anonymous false alone does not enforce super-admin conversations.
4. Queue bounded objectives through manageAdminBuilderWork; preserve requested/implemented:false and owner-scoped delegation. Save investigated incident plans with source evidence, tests, exact diff/scope and rollback before approving.
5. Preserve base44/shared/approvedBuilderBridge.ts flags, backend-only credential references and fixed app target. A paid builder turn requires separately permitted credentials AND explicit lifting of the zero-credit constraint. The current documentation work authorizes neither.
6. Keep builder dispatch, source verification, tests and final release approval separate. Provider acceptance or a completed conversation is not a verified code change or deployment.
7. Reconcile the Cloudflare gateway allowlist mismatch described in Worker 1 before claiming this agent is available through Cloudflare. Independently verify direct conversation creation/read/message/subscription access is admin-only. If the platform cannot enforce it, keep the conversation exposure disabled and use authenticated admin panels.
8. Connect the client through the separate super-admin workspace; never the ordinary member selector. Preserve `AgentMonitor`/`AgentChat` conversation lifecycle: createConversation with exact agent_name, subscribe/getConversation, addMessage in the authenticated user context, unsubscribe on change/unmount, and preserve pending/error/approval states. Use the existing Base44 client until an independent API has passed the shared boundary gates.
9. For Cloudflare, implement/register this role in the workforce runtime with exactly this configuration and selected tool adapters; test in shadow mode first. The current catalog-only Worker cannot execute this step. Do not switch production traffic merely by toggling the execution variable.
10. Verify the role-specific acceptance cases below, then complete the shared release record. Keep activation disabled if remote skills, memory, model budget, tool auth or provider evidence is unresolved.

**Acceptance and live evidence**

- Anonymous, ordinary member, authenticated non-owner admin and spoofed owner IDs must be denied by every tool and direct conversation route.
- An approved super-admin can list/queue a synthetic task; the result remains requested and no code/build/deploy claim appears.
- Incident report prompt injection must not auto-approve, dispatch a builder turn or obtain secrets.
- With paid execution disabled, approving a plan must not call metered builder APIs. Separate release controls require revision/test evidence and fresh super-admin approval.
- Run the common source-only checks and the role-relevant tests below; hosted evidence is still required for real auth, memory, consent and provider behavior.

```sh
node scripts/verify-builder-agent-boundary.mjs
node scripts/test-chatgpt-builder-handoff.mjs
```

**Triggers and dependencies:** Admin Action Conversation Router can create admin workflow work only through its own reviewed gates. The retired builder_agent identity remains deferred in docs/deferred-admin-builder-agent.md; do not recreate it as a second admin assistant.

**Rollback and next agent:** stop new `admin_builder_agent` Cloudflare dispatch, retain/reconcile accepted job/provider receipts, restore this role’s prior routing/configuration/skill bindings from the protected backup, and verify its existing Base44 path. Do not delete conversations, memory, grants or task audit history. Complete this agent’s release record before enabling the next chapter.

### Workflow-by-workflow implementation

Every chapter records the full source trigger and ordered steps. `definition` objects remain canonical in `base44/workflows/`. Empty args stay empty; expressions are data-bound by a trusted executor, not arbitrary code. UI metadata in `x-base44` may be preserved for editing but never grants execution authority.

<a id="workflow-implementation-1"></a>

#### Workflow 1 — AI Outreach Agent

**Description:** Runs the autonomous AI Outreach Agent on a schedule for campaigns opted in by creators with an active outreach-tier subscription. Every action is recorded for owner approval.

**Canonical source:** [`base44/workflows/AI Outreach Agent.jsonc`](../base44/workflows/AI Outreach Agent.jsonc); associated role/surface: Outreach; recommendation generator. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "0 */6 * * *",
    "one_time_date": null,
    "timezone": "UTC",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "ai_outreach_agent",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "run_agent": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "runOutreachAgent",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Run outreach agent",
          "description": "Analyze opted-in campaigns"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Use only opted-in, unpaused eligible campaigns. Verify account/tier at run time and bounded generation budget. Store Recommendation/AgentActivity as proposals; no outbound send or publication is implied.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `0 */6 * * *` in `UTC` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`runOutreachAgent`](../base44/functions/runOutreachAgent/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Duplicate the same logical campaign/run slot; one artifact set at most. Opt-out, expired tier and budget zero must skip without inference.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-2"></a>

#### Workflow 2 — Admin Action Conversation Router

**Description:** Routes admin requests for more information back to the requesting agent and returns a grounded response to the same admin action thread.

**Canonical source:** [`base44/workflows/Admin Action Conversation Router.jsonc`](../base44/workflows/Admin Action Conversation Router.jsonc); associated role/surface: Admin tools and originating specialist threads. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "*/15 * * * *",
    "one_time_date": null,
    "timezone": "America/Los_Angeles",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "admin_action_conversation_router",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "route_questions": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "processAdminActionInbox",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Route admin questions",
          "description": "Return verified agent information to the same admin action thread"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Bind each item to the verified requesting admin, source agent and original conversation/action thread. Recheck admin permission before returning scoped information; never route a member-authored forged admin request.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `*/15 * * * *` in `America/Los_Angeles` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`processAdminActionInbox`](../base44/functions/processAdminActionInbox/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Replayed inbox item must not create duplicate threads; unauthorized requester and missing original-thread references fail closed.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-3"></a>

#### Workflow 3 — Campaign Protocol

**Description:** Enforces Michelle's Campaign Protocol on every campaign: outreach on by default, active-status required-field validation, and AI profile completeness follow-up. Fires on campaign create and on updates to protocol-relevant fields (not on routine donation-total increments).

**Canonical source:** [`base44/workflows/Campaign Protocol.jsonc`](../base44/workflows/Campaign Protocol.jsonc); associated role/surface: Campaign lifecycle; coordinator/strategy consumers. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "config": {
    "trigger_type": "entity",
    "entity_name": "Campaign",
    "events": [
      "create",
      "update"
    ]
  },
  "condition": "${ .trigger.event_type == \"create\" or any((.trigger.changed_fields // [])[]; IN(\"status\",\"outreach_enabled\",\"title\",\"summary\",\"story\",\"category\",\"cover_image_url\",\"end_date\",\"goal_amount\",\"ai_profile\")) }"
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "campaign_protocol",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "enforce": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "enforceCampaignProtocol",
          "args": {
            "campaign_id": "${ .trigger.entity_id }"
          }
        },
        "then": "end",
        "x-base44": {
          "title": "Enforce Campaign Protocol",
          "description": "Outreach default, active gate, AI profile check"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Preserve the complete source condition so routine total changes do not recurse. Only validated owned campaign fields may be normalized; protocol defaults must not override explicit opt-out or clear owner intent.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Subscribe only to authenticated `Campaign` events `create, update` from the canonical backend. Evaluate the exact condition against trusted old/new state before creating one durable logical run. No Cloudflare cron entry is appropriate for this event trigger.
4. Bind only these canonical backend implementations: [`enforceCampaignProtocol`](../base44/functions/enforceCampaignProtocol/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Create/update an owned fixture; test irrelevant donation-total update, repeated event, missing required fields and explicitly paused outreach.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-4"></a>

#### Workflow 4 — Campaign Sync on Create

**Description:** When a new campaign is created, syncs connections to initialize cross-platform distribution. The hourly Connection Sync Engine continues to handle health checks and retries.

**Canonical source:** [`base44/workflows/Campaign Sync on Create.jsonc`](../base44/workflows/Campaign Sync on Create.jsonc); associated role/surface: Connections and distribution. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "entity",
    "events": [
      "create"
    ],
    "entity_name": "Campaign"
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "campaign_sync_on_create",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "sync": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "syncConnections",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Sync connections",
          "description": "Initialize distribution"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. The source dispatches syncConnections with empty args. Do not assume it is narrowly scoped by campaign_id. Audit the function’s scheduler/service-role semantics and potential cross-campaign side effects before dispatching from an event.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Subscribe only to authenticated `Campaign` events `create` from the canonical backend. Evaluate the exact condition against trusted old/new state before creating one durable logical run. No Cloudflare cron entry is appropriate for this event trigger.
4. Bind only these canonical backend implementations: [`syncConnections`](../base44/functions/syncConnections/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: A replayed campaign-create event cannot duplicate distribution; no publishing without destination approval/grants.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-5"></a>

#### Workflow 5 — Campaign Sync on Update

**Description:** When a campaign update is published (ready to distribute), syncs connections to push the content out across connected platforms. Complements the hourly Connection Sync Engine.

**Canonical source:** [`base44/workflows/Campaign Sync on Update.jsonc`](../base44/workflows/Campaign Sync on Update.jsonc); associated role/surface: Campaign-update distribution. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "entity",
    "events": [
      "create"
    ],
    "entity_name": "CampaignUpdate"
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "campaign_sync_on_update",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "sync": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "syncConnections",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Sync connections",
          "description": "Distribute the new update"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. The entity is CampaignUpdate and the event is create: this correctly describes a newly published campaign update, not a wrong Campaign update event. Preserve it. The function currently receives empty args, so independently review global sync scope.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Subscribe only to authenticated `CampaignUpdate` events `create` from the canonical backend. Evaluate the exact condition against trusted old/new state before creating one durable logical run. No Cloudflare cron entry is appropriate for this event trigger.
4. Bind only these canonical backend implementations: [`syncConnections`](../base44/functions/syncConnections/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: CampaignUpdate create matches; CampaignUpdate update and Campaign create must not trigger this particular workflow. Verify actual provider receipts for any approved distribution.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-6"></a>

#### Workflow 6 — Connection Sync Engine

**Description:** Hourly background worker: publishes due scheduled posts, retries failed publishes, and monitors connection health across all connected platforms.

**Canonical source:** [`base44/workflows/Connection Sync Engine.jsonc`](../base44/workflows/Connection Sync Engine.jsonc); associated role/surface: Connections, scheduled distribution and recovery. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "0 * * * *",
    "one_time_date": null,
    "timezone": "America/Los_Angeles",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "connection_sync_engine",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "sync_connections": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "syncConnections",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Sync connections",
          "description": "Publish due posts, retry failures, check health"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Publish only due approved/auto-authorized work after current consent/capability checks. Bound retries; uncertain submission requires reconciliation. Do not restore scheduled external fundraising imports; see the request-triggered-only policy.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `0 * * * *` in `America/Los_Angeles` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`syncConnections`](../base44/functions/syncConnections/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Test due/not-due posts, revoked consent, provider 429, timeout-after-submit, duplicate schedule slots and unsupported providers.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-7"></a>

#### Workflow 7 — External Feed Mirroring

**Description:** Hourly mirrors new posts from connected external social platforms (Bluesky, Mastodon, Discord) into the internal Interplanetary Social feed, deduplicated by external post id. Platforms without a readable API are reported and never faked.

**Canonical source:** [`base44/workflows/External Feed Mirroring.jsonc`](../base44/workflows/External Feed Mirroring.jsonc); associated role/surface: Growth and internal social feed. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "0 * * * *",
    "one_time_date": null,
    "timezone": "UTC",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "external_feed_mirroring",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "mirror_posts": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "mirrorExternalPosts",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Mirror external posts",
          "description": "Sync external feeds into Interplanetary Social"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Use only provider-approved read APIs and owned verified connections. Deduplicate by stable provider account/post identifiers. Unsupported providers report unavailable; do not scrape private content or fabricate mirrored posts.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `0 * * * *` in `UTC` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`mirrorExternalPosts`](../base44/functions/mirrorExternalPosts/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Replay identical external post IDs; one authorized internal mirror only. Other-owner/private/disconnected accounts must not leak content.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-8"></a>

#### Workflow 8 — Feature Discovery on Completion

**Description:** When a user's campaign reaches completed status, scans that user's account for features they haven't used yet and surfaces them as growth recommendations.

**Canonical source:** [`base44/workflows/Feature Discovery on Completion.jsonc`](../base44/workflows/Feature Discovery on Completion.jsonc); associated role/surface: Growth and account recommendations. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "config": {
    "trigger_type": "entity",
    "entity_name": "Campaign",
    "events": [
      "update"
    ]
  },
  "condition": "${ .trigger.data.status == \"completed\" and .trigger.old_data.status != \"completed\" }"
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "feature_discovery_on_completion",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "discover": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "discoverFeatures",
          "args": {
            "user_id": "${ .trigger.data.created_by_id }"
          }
        },
        "then": "end",
        "x-base44": {
          "title": "Discover features",
          "description": "Scan account for unused features"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Require the exact old/new completed-status transition condition. The user_id expression comes from a verified event whose campaign owner is confirmed server-side; do not trust an arbitrary event body.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Subscribe only to authenticated `Campaign` events `update` from the canonical backend. Evaluate the exact condition against trusted old/new state before creating one durable logical run. No Cloudflare cron entry is appropriate for this event trigger.
4. Bind only these canonical backend implementations: [`discoverFeatures`](../base44/functions/discoverFeatures/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Test active→completed once, completed→completed no-op, other status changes no-op, duplicate event and forged owner ID.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-9"></a>

#### Workflow 9 — Grant Application Review

**Description:** When a new grant application is submitted, the Strategy Agent analyzes it and recommends a decision, then notifies the institution owner to review and decide. AI recommends; a human awards (per the platform's AI-recommends-not-executes principle).

**Canonical source:** [`base44/workflows/Grant Application Review.jsonc`](../base44/workflows/Grant Application Review.jsonc); associated role/surface: Strategy-style analysis; institutional review. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "config": {
    "trigger_type": "entity",
    "entity_name": "GrantApplication",
    "events": [
      "create"
    ]
  },
  "condition": "${ .trigger.data.status == \"submitted\" }"
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "grant_application_review",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "analyze": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "analyzeGrantApplication",
          "args": {
            "application_id": "${ .trigger.entity_id }"
          }
        },
        "then": "end",
        "x-base44": {
          "title": "Analyze application",
          "description": "Strategy Agent recommends a decision"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. The workflow calls analyzeGrantApplication, not the conversational strategy_agent directly. Recheck application/institution ownership and reviewer visibility. AI may recommend; only the authorized human award workflow makes the decision.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Subscribe only to authenticated `GrantApplication` events `create` from the canonical backend. Evaluate the exact condition against trusted old/new state before creating one durable logical run. No Cloudflare cron entry is appropriate for this event trigger.
4. Bind only these canonical backend implementations: [`analyzeGrantApplication`](../base44/functions/analyzeGrantApplication/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Create a synthetic application; analysis/notification must not award a grant or transfer funds. Deny unrelated institution access and duplicate-review side effects.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-10"></a>

#### Workflow 10 — IFund Official Social Editor

**Description:** Every four hours, prepare moderated IFund-branded posts for explicitly verified official Facebook group, Instagram and Facebook Business destinations. No 12-hour member campaign cap. Never claim Instagram or Facebook Group publishing without verified provider execution.

**Canonical source:** [`base44/workflows/IFund Official Social Editor.jsonc`](../base44/workflows/IFund Official Social Editor.jsonc); associated role/surface: Platform-owned Outreach/editorial. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "0 */4 * * *",
    "one_time_date": null,
    "timezone": "America/Los_Angeles",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "ifund_official_social_editor",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "prepare_official_posts": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "runOfficialSocialPromotion",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Prepare official social editorials",
          "description": "Use current brand research to prepare official platform-first promotions and moderation drafts"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Keep verified platform-owned destinations and owner delegation separate from member connections. Content moderation/preparation is not provider publication. Do not promise unsupported Instagram/Group posting or inherit a member’s standing grant.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `0 */4 * * *` in `America/Los_Angeles` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`runOfficialSocialPromotion`](../base44/functions/runOfficialSocialPromotion/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Unverified official destinations stay unverified; synthetic drafts must not publish without actual destination-specific permission and provider evidence.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-11"></a>

#### Workflow 11 — IFund Reporter Daily Diary

**Description:** Publishes one carefully scoped factual issue per day in the official IFund Reporter public blog, linked from the Community Stories & blogs tab. No external social posting or paid actions.

**Canonical source:** [`base44/workflows/IFund Reporter Daily Diary.jsonc`](../base44/workflows/IFund Reporter Daily Diary.jsonc); associated role/surface: Official Reporter blog automation. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "30 17 * * *",
    "timezone": "America/Los_Angeles",
    "one_time_date": null,
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "ifund_reporter_daily_diary",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "publish_reporter_story": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "runReporterDiary",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Publish IFund reporter diary",
          "description": "Create a single source-constrained public newsletter issue and show it in Community Stories"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. This is a backend publishing workflow, not an additional JSONC chat agent. Preserve one factual source-constrained daily issue, correct official blog ownership and deduplication; no automatic external social post.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `30 17 * * *` in `America/Los_Angeles` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`runReporterDiary`](../base44/functions/runReporterDiary/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Same logical publication date produces at most one issue. Missing evidence or owner authorization blocks publication instead of inventing news.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-12"></a>

#### Workflow 12 — Integration Health Check

**Description:** Pre-built future scheduled integration-health workflow. Runs the existing non-destructive health validator so provider failures can be surfaced before dependent automation executes.

**Canonical source:** [`base44/workflows/Integration Health Check.jsonc`](../base44/workflows/Integration Health Check.jsonc); associated role/surface: Discovery/connection health. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "30 */6 * * *",
    "one_time_date": null,
    "timezone": "America/Los_Angeles",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "integration_health_check",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "validate_integrations": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "validateIntegrationHealth",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Validate integrations",
          "description": "Run non-destructive provider health checks and surface unhealthy connections"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Source calls this a pre-built future workflow. Obtain explicit verified need/current state before enabling. Safe provider reads may update observed health only from actual provider results; configuration alone does not make a connection healthy.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `30 */6 * * *` in `America/Los_Angeles` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`validateIntegrationHealth`](../base44/functions/validateIntegrationHealth/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Failed or unsupported health probes report accurate unavailable/degraded states without changing credentials or publishing.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-13"></a>

#### Workflow 13 — PayPal Holding Settlement Reconciliation

**Description:** Hourly custody reconciliation: discovers settled receipts in the Interplanetary Fund business PayPal holding account and conservatively matches each receipt to exactly one provider-verified exterior fund observation. Ambiguous or unmatched receipts remain unallocated for admin review.

**Canonical source:** [`base44/workflows/PayPal Holding Settlement Reconciliation.jsonc`](../base44/workflows/PayPal Holding Settlement Reconciliation.jsonc); associated role/surface: Protected financial settlement backend; Finance observes results. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "0 * * * *",
    "one_time_date": null,
    "timezone": "America/Los_Angeles",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "paypal_holding_settlement_reconciliation",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "discover_and_reconcile": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "discoverPayPalHoldingSettlements",
          "args": {
            "lookback_hours": 24
          }
        },
        "then": "end",
        "x-base44": {
          "title": "Reconcile PayPal holding receipts",
          "description": "Verify recent PayPal receipts and allocate only unique exterior-fund matches"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Use only actual provider-verified holding receipts. Preserve unique receipt identity, currency, amount, destination and conservative one-observation match. Ambiguous/unmatched receipts remain unallocated for admin review. This is not a model-created donation or transfer tool.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `0 * * * *` in `America/Los_Angeles` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`discoverPayPalHoldingSettlements`](../base44/functions/discoverPayPalHoldingSettlements/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Replay receipts, concurrent claims, ambiguous matches, differing currencies, refunds and provider timeout; never duplicate ledger credit or allocate uncertain funds.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-14"></a>

#### Workflow 14 — Platform Account Steward

**Description:** Outreach checks official Interplanetary Fund accounts every day, queues missing-account/setup work for admin approval, and prepares the weekly official update when due.

**Canonical source:** [`base44/workflows/Platform Account Steward.jsonc`](../base44/workflows/Platform Account Steward.jsonc); associated role/surface: Platform-owned Outreach/account maintenance. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "30 15 * * *",
    "one_time_date": null,
    "timezone": "America/Los_Angeles",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "platform_account_steward",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "maintain_accounts": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "maintainPlatformOwnedAccounts",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Maintain official accounts",
          "description": "Check account health, setup needs, and weekly posts"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Inspect official account metadata and capabilities without exposing credential references to model prompts. Queue missing-account/setup work for admin approval. A queued account setup or weekly draft does not prove account creation or posting.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `30 15 * * *` in `America/Los_Angeles` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`maintainPlatformOwnedAccounts`](../base44/functions/maintainPlatformOwnedAccounts/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Missing credential/provider access produces a truthful setup task; ordinary member grants cannot modify platform-owned accounts; repeated daily slots do not duplicate work.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-15"></a>

#### Workflow 15 — Social Media Autopilot

**Description:** Fully autonomous social media management: daily generates one truthful post per eligible campaign and stages it on the owner's connected social destinations — auto connections get it scheduled for publishing, ask/draft connections stage it for owner approval. Gated by the owner's explicit, revocable AI-publishing consent plus campaign and destination automation settings; no separate recurring grant or per-post reconfirmation is required. Capped at one post per campaign per week.

**Canonical source:** [`base44/workflows/Social Media Autopilot.jsonc`](../base44/workflows/Social Media Autopilot.jsonc); associated role/surface: Outreach/communications distribution automation. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "0 14 * * *",
    "one_time_date": null,
    "timezone": "UTC",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "social_media_autopilot",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "run_autopilot": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "runSocialAutopilot",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Run social autopilot",
          "description": "Generate and stage cross-platform posts"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Preserve current backend cadence rather than reading “daily” as permission for daily publishing. Description says weekly campaign cap; inspect actual throttle. Auto/ask/draft destinations remain distinct, with revocable owner AI publishing consent and provider-specific evidence.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `0 14 * * *` in `UTC` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`runSocialAutopilot`](../base44/functions/runSocialAutopilot/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Test each automation mode, cadence limit, paused campaign, revoked grant, duplicate slot and provider retry. Ask/draft destinations must not publish automatically.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-16"></a>

#### Workflow 16 — Volunteer Welcome Follow-up

**Description:** Welcomes a new volunteer with an email and in-app note, waits 3 days, then sends a follow-up invite to complete their profile if they haven't yet.

**Canonical source:** [`base44/workflows/Volunteer Welcome Follow-up.jsonc`](../base44/workflows/Volunteer Welcome Follow-up.jsonc); associated role/surface: Communications and private volunteer onboarding. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "entity",
    "events": [
      "create"
    ],
    "entity_name": "VolunteerSignup"
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "volunteer_welcome_followup",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "welcome": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "welcomeVolunteer",
          "args": {
            "signup_id": "${ .trigger.entity_id }"
          }
        },
        "then": "wait_period",
        "x-base44": {
          "title": "Send welcome",
          "description": "Email + in-app welcome"
        }
      }
    },
    {
      "wait_period": {
        "wait": "P3D",
        "then": "follow_up"
      }
    },
    {
      "follow_up": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "volunteerFollowUp",
          "args": {
            "signup_id": "${ .trigger.entity_id }"
          }
        },
        "then": "end",
        "x-base44": {
          "title": "Follow up",
          "description": "Invite to complete profile"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Persist the P3D delay durably, including signup ID, owner, consent, destination and current step. Recheck profile completion, recipient preferences and authority after the delay. Never sleep inside one Worker request or reset the delay on deployment/retry.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Subscribe only to authenticated `VolunteerSignup` events `create` from the canonical backend. Evaluate the exact condition against trusted old/new state before creating one durable logical run. No Cloudflare cron entry is appropriate for this event trigger.
4. Bind only these canonical backend implementations: [`welcomeVolunteer`](../base44/functions/welcomeVolunteer/entry.ts); [`volunteerFollowUp`](../base44/functions/volunteerFollowUp/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Advance a deterministic clock across three days; no early follow-up, at most one welcome/follow-up, restart resumes the same job, opt-out/profile completion suppresses follow-up as the canonical function requires.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

<a id="workflow-implementation-17"></a>

#### Workflow 17 — Weekly Writing Psychology & Social Trends Training

**Description:** Retrieves and synthesizes public donor psychology and current social trends once per week; daily schedule retries only if no successful weekly research exists. Weekly deduplication prevents repeated metered AI calls.

**Canonical source:** [`base44/workflows/Weekly Writing Psychology & Social Trends Training.jsonc`](../base44/workflows/Weekly Writing Psychology & Social Trends Training.jsonc); associated role/surface: Shared research brief for writing-capable specialists. The source is not proof of enabled status.

**Exact trigger, conditions and schedule selections**

```json
{
  "condition": null,
  "config": {
    "trigger_type": "scheduled",
    "events": [],
    "schedule_mode": "recurring",
    "cron_expression": "0 16 * * *",
    "one_time_date": null,
    "timezone": "UTC",
    "interval_value": null,
    "interval_unit": null,
    "interval_anchor": null,
    "ends_type": "never",
    "ends_on_date": null,
    "ends_after_count": null
  }
}
```

**Exact ordered steps, arguments, delays, transitions and editor metadata**

```json
{
  "document": {
    "dsl": "1.0.0",
    "name": "weekly_writing_psychology_training",
    "version": "1.0",
    "namespace": "base44"
  },
  "do": [
    {
      "study_sources": {
        "call": "invoke_backend_function",
        "with": {
          "function_name": "refreshWritingResearch",
          "args": {}
        },
        "then": "end",
        "x-base44": {
          "title": "Review donation psychology and social trends",
          "description": "Research real studies and current culture; update sourced writing guidance"
        }
      }
    }
  ]
}
```

**Implement and attach**

1. Read this source and every linked backend below. Daily cron is intentional retry opportunity: refreshWritingResearch derives a UTC Monday week_key, reuses a completed weekly brief and defers recent attempts. Preserve these guards before any network/inference call. Do not change to weekly cron based only on the name; strengthen atomic concurrency protection if needed.
2. Complete Worker 3’s trusted ingress/scheduler, durable state, single-executor ownership, audit and rollback requirements. Preserve every source condition, timezone and step argument shown above. Check imported function guards and environment/connector dependencies; the workflow service must not bypass them.
3. Resolve recurring schedule `0 16 * * *` in `UTC` with timezone-aware due selection, persisted slot deduplication and the source end policy. Confirm the actual Base44 schedule is not still executing the same action before enabling Cloudflare triggers.
4. Bind only these canonical backend implementations: [`refreshWritingResearch`](../base44/functions/refreshWritingResearch/entry.ts). Deploy/verify an equivalent adapter separately if independent execution is required; the catalog Worker does not contain these implementations.
5. Verify: Within the same week reuse the completed brief without provider calls; test concurrent attempts, failed/partial synthesis, next-week rollover and zero-budget skip. Historical source evidence is not a verified live free-inference entitlement.
6. Record one bounded nonproduction run with logical event/slot ID, step outcomes and evidence. Activate only this workflow after parity/permission review. Roll back by stopping new claims and reconciling pending/uncertain results before restoring the prior executor; never delete deduplication or receipts.

### Runtime configuration and access inventory

This lists names and purposes only. Supply secret values through the existing protected server configuration UI/connection, never through public frontend settings, prompts, commands in documentation, or logs. Exact endpoint values come from the verified deployment. Configure preview and production separately; never inherit production financial/secret bindings into a preview.

#### Configuration consumed by `host/gateway/worker.js`

| Setting/binding name | Purpose and selection |
| --- | --- |
| `IFUND_ADMIN_AGENT_KEY` | Protected server-only additional development key gate; not identity. |
| `IFUND_ADMIN_VERIFY_URL` | Actual canonical verifyAdminGateway HTTPS function endpoint. |
| `IFUND_AGENT_ACTIONS_PAUSED` | Emergency source-supported pause flag; verify exactly which routes it covers. |
| `IFUND_AGENT_CAMPAIGNS_URL` | Actual canonical externalAgentCampaigns endpoint; read scope only. |
| `IFUND_AGENT_CONTENT_WRITE_URL` | Actual canonical externalAgentContentWrite endpoint; separate consent/owner checks. |
| `IFUND_AGENT_EXECUTE_URL` | Actual canonical executeAdminAgentRequest HTTPS endpoint. |
| `IFUND_ALLOWED_ORIGINS` | Exact approved browser origin allowlist; no wildcard/reflected origins. |
| `IFUND_AUDIT_URL` | Actual canonical auditAdminAgentGateway endpoint; retain failure visibility. |
| `IFUND_BASE44_ORIGIN` | Canonical HTTPS Base44 upstream; not a replacement data authority. |
| `IFUND_INDEPENDENT_AUTH_PREVIEW` | Keep migration auth preview disabled unless separately verified; no production authority change. |
| `IFUND_SERVICE_TOKEN` | Protected optional service audit credential; never a substitute for the invoking user. |
| `IFUND_SESSION_SECRET` | Protected server-only HMAC session signing secret; rotation invalidates sessions. |
| `IFUND_SUPABASE_PROJECT_REF` | Existing alternate-backend preview dependency reference; inventory, do not provision a new authority. |
| `IFUND_SUPABASE_PUBLISHABLE_KEY` | Existing preview client configuration; preserve current access policy, not a service-role credential. |

#### Configuration consumed by `host/gateway/campaign-assistant.js`

| Setting/binding name | Purpose and selection |
| --- | --- |
| `AI` | Optional Workers AI binding for campaign assistant only; no workforce execution grant. |
| `CAMPAIGN_AI_LIMITER` | Required limiter binding for approved campaign inference; not a durable job/idempotency store. |
| `IFUND_ALLOWED_ORIGINS` | Exact approved browser origin allowlist; no wildcard/reflected origins. |
| `IFUND_CAMPAIGN_AI_ENABLED` | Campaign inference feature gate; keep disabled until model/terms/quota/auth tests pass. |

#### Configuration consumed by `host/workforce/worker.js`

No environment settings are read by this current inspection-only handler. The execution flag in its Wrangler file is a preservation marker; it does not enable an executor.

#### Configuration consumed by `host/workflows/worker.js`

No environment settings are read by this current inspection-only handler. The execution flag in its Wrangler file is a preservation marker; it does not enable an executor.

#### Configuration consumed by `host/email/worker.js`

| Setting/binding name | Purpose and selection |
| --- | --- |
| `IFUND_ADMIN_EMAIL_RECEIVER_URL` | Existing organizational signed intake endpoint; verify actual persistence/tenant boundary. |
| `IFUND_EMAIL_RECEIVER_URL` | Isolated verification intake HTTPS endpoint; never organizational fallback. |
| `IFUND_EMAIL_SIGNING_PRIVATE_KEY` | Protected ECDSA P-256 private signing material; never export to prompts or docs. |
| `IFUND_MEMBER_EMAIL_RECEIVER_URL` | Paid-member private recipient intake; validates entitlement and mailbox ownership. |

#### Configuration consumed by `host/oauth/worker.js`

| Setting/binding name | Purpose and selection |
| --- | --- |
| `IFUND_ADMIN_VERIFY_URL` | Actual canonical verifyAdminGateway HTTPS function endpoint. |
| `IFUND_AGENT_CAMPAIGNS_URL` | Actual canonical externalAgentCampaigns endpoint; read scope only. |
| `IFUND_OAUTH_ADMIN_BRIDGE_SECRET` | Protected optional standalone-OAuth admin bridge gate; not a member grant. |
| `IFUND_OAUTH_AGENT_KEY` | Protected standalone-OAuth downstream campaign-feed credential; read-only scope. |
| `IFUND_OAUTH_PORTAL_URL` | Verified HTTPS consent portal for the optional standalone issuer. |
| `OAUTH_DB` | Historical standalone-OAuth database binding; dormant and not authorized for provisioning by this document. |
| `OAUTH_ENABLED` | Keep optional standalone issuer disabled until storage/auth/issuer parity is verified. |
| `OAUTH_INTROSPECTION_SECRET` | Protected separate internal introspection gate; never expose to OAuth clients. |


#### Frontend, backend and remote access selections

| Access point | Selection and constraint |
| --- | --- |
| `src/api/base44Client.js` | Keep the same canonical app ID/backend across approved hosts; preserve caller-authenticated SDK behavior |
| `src/pages/Agents.jsx` | Nine selectable agents; subscription gating plus Managed Connections level 2; server gates remain mandatory |
| `src/components/agents/AgentMonitor.jsx`, `AgentChat.jsx` | Conversation UI, selected campaign, pending tools, subscriptions and user-only approval actions |
| `src/components/agents/AgentContentReview.jsx` | Human draft review; content proposal is not permission to publish |
| `src/components/agents/AdminDevelopmentChat.jsx`, `BuilderExecutionControls.jsx`, `PlatformFixReviewPanel.jsx` | Separate super-admin workspace; direct APIs must independently deny ordinary users |
| `src/lib/adminAgentGateway.js` | Public gateway URL plus current Base44 authentication; never ship server keys |
| `src/pages/AdminAgentApi.jsx` and `docs/MAKE_AGENT_REST_API.md` | Scoped external agent keys and read feed; separate from member chat and MCP OAuth |
| `src/lib/subscriptionEntitlements.js`, `base44/shared/subscriptionEntitlements.ts` | Current active/trial/day-pass/tier behavior; server rechecks role-specific entitlements |
| `base44/entities/*.jsonc` | Exact entity schemas and RLS; direct agent operations remain no broader than selected tool operations |
| `base44/shared/accountGuard.ts`, `integrationRegistry.ts`, `featureFlagGate.ts` | Active-account, OBO/provider and feature gates; preserve imported guard semantics |
| `base44/shared/approvedBuilderBridge.ts` | Backend-only builder flags/credential references and fixed application target; no dispatch while zero-credit constraint applies |
| Cloudflare Workers & Pages / Settings / Variables and Secrets / Bindings | Inspect existing resources; preserve unrelated bindings and use encrypted server secrets for credentials |
| Cloudflare zone / Worker Routes / DNS / Email Routing | Verify current account/zone and existing records; changing registrar nameservers or mail routing needs its own verified rollback |
| Provider developer applications and authorization screens | Exact provider-approved callback/origin, requested versus granted scopes, actual verified capabilities; human completes provider MFA/CAPTCHA |
| Base44 remote agent/skill management | Full remote inventory/backups before replacement operations; local selected IDs are references, not proof of content or grant |
| Existing Make/Wix/browser connectors | Optional provider-approved transports; preserve actual installed grants and route health, never assume global execution access |


#### Complete selected backend dependency index

Each entry links the exact implementation and its direct local dependencies. Before implementing a Worker adapter, follow these imports transitively and preserve their guards, RLS, provider calls, feature gates and runtime configuration. `npm:`/Deno imports require a Workers-compatible adaptation; file copying is not enough. Empty dependency lists mean no relative imports, not no external services. Per-function input validation and response types remain authoritative in the linked entrypoint. The input-name inventory is lexical, not a substitute for a typed schema: names may be optional or conditional.

**`analyzeGrantApplication`** — [`entry.ts`](../base44/functions/analyzeGrantApplication/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: `application_id`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`discoverConnectionMethods`** — [`entry.ts`](../base44/functions/discoverConnectionMethods/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/connectionVerification.ts`](../base44/shared/connectionVerification.ts); [`base44/shared/platformConnectionRecipes.ts`](../base44/shared/platformConnectionRecipes.ts).
Request input names to validate against the parser: `operation`, `platform`, `subject`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`discoverFeatures`** — [`entry.ts`](../base44/functions/discoverFeatures/entry.ts).
Direct local dependencies: [`base44/shared/subscriptionEntitlements.ts`](../base44/shared/subscriptionEntitlements.ts).
Request input names to validate against the parser: `user_id`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`discoverPayPalHoldingSettlements`** — [`entry.ts`](../base44/functions/discoverPayPalHoldingSettlements/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/paypal.ts`](../base44/shared/paypal.ts); [`base44/shared/auditLog.ts`](../base44/shared/auditLog.ts).
Request input names to validate against the parser: `lookback_hours`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`enforceCampaignProtocol`** — [`entry.ts`](../base44/functions/enforceCampaignProtocol/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`generateIntelligence`** — [`entry.ts`](../base44/functions/generateIntelligence/entry.ts).
Direct local dependencies: [`base44/shared/featureFlagGate.ts`](../base44/shared/featureFlagGate.ts); [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/rateLimit.ts`](../base44/shared/rateLimit.ts).
Request input names to validate against the parser: `mode`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`getAgentAccountContext`** — [`entry.ts`](../base44/functions/getAgentAccountContext/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`getStripeIntegrationAudit`** — [`entry.ts`](../base44/functions/getStripeIntegrationAudit/entry.ts).
Direct local dependencies: [`base44/shared/subscriptionCatalog.js`](../base44/shared/subscriptionCatalog.js); [`base44/shared/stripeSubscriptionCatalog.ts`](../base44/shared/stripeSubscriptionCatalog.ts); [`base44/shared/stripeCryptoReadiness.ts`](../base44/shared/stripeCryptoReadiness.ts).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`getVerifiedIFundIntegrationContext`** — [`entry.ts`](../base44/functions/getVerifiedIFundIntegrationContext/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/connectionVerification.ts`](../base44/shared/connectionVerification.ts); [`base44/shared/platformConnectionRecipes.ts`](../base44/shared/platformConnectionRecipes.ts).
Request input names to validate against the parser: `platform`, `subject`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`getWritingResearchBrief`** — [`entry.ts`](../base44/functions/getWritingResearchBrief/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/subscriptionEntitlements.ts`](../base44/shared/subscriptionEntitlements.ts).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`listConnections`** — [`entry.ts`](../base44/functions/listConnections/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts).
Request input names to validate against the parser: `scope`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`listFundraisingProviderCapabilities`** — [`entry.ts`](../base44/functions/listFundraisingProviderCapabilities/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/providerCapabilities.ts`](../base44/shared/providerCapabilities.ts).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`maintainPlatformOwnedAccounts`** — [`entry.ts`](../base44/functions/maintainPlatformOwnedAccounts/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`manageAdminBuilderWork`** — [`entry.ts`](../base44/functions/manageAdminBuilderWork/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/auditLog.ts`](../base44/shared/auditLog.ts).
Request input names to validate against the parser: `context_summary`, `mode`, `objective`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`manageAgentContentDraft`** — [`entry.ts`](../base44/functions/manageAgentContentDraft/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts).
Request input names to validate against the parser: `campaign_id`, `connection_id`, `draft_id`, `kind`, `mode`, `payload`, `source_agent`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`managePlatformIncidents`** — [`entry.ts`](../base44/functions/managePlatformIncidents/entry.ts).
Direct local dependencies: [`base44/shared/auditLog.ts`](../base44/shared/auditLog.ts); [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/rateLimit.ts`](../base44/shared/rateLimit.ts); [`base44/shared/approvedBuilderBridge.ts`](../base44/shared/approvedBuilderBridge.ts).
Request input names to validate against the parser: `analysis`, `code`, `incident_id`, `kind`, `mode`, `note`, `repair_plan`, `rollback_plan`, `route`, `source`, `summary`, `systemic_scope`, `verification_plan`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`mirrorExternalPosts`** — [`entry.ts`](../base44/functions/mirrorExternalPosts/entry.ts).
Direct local dependencies: [`base44/shared/featureFlagGate.ts`](../base44/shared/featureFlagGate.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`processAdminActionInbox`** — [`entry.ts`](../base44/functions/processAdminActionInbox/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`refreshWritingResearch`** — [`entry.ts`](../base44/functions/refreshWritingResearch/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`repairStripeWebhookEvents`** — [`entry.ts`](../base44/functions/repairStripeWebhookEvents/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`requestManagedConnectionAction`** — [`entry.ts`](../base44/functions/requestManagedConnectionAction/entry.ts).
Direct local dependencies: [`base44/shared/featureFlagGate.ts`](../base44/shared/featureFlagGate.ts); [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts); [`base44/shared/subscriptionEntitlements.ts`](../base44/shared/subscriptionEntitlements.ts); [`base44/shared/platformConnectionRecipes.ts`](../base44/shared/platformConnectionRecipes.ts).
Request input names to validate against the parser: `action`, `campaign_id`, `connection_id`, `platform`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`resolveConnectionStatus`** — [`entry.ts`](../base44/functions/resolveConnectionStatus/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts); [`base44/shared/connectionVerification.ts`](../base44/shared/connectionVerification.ts); [`base44/shared/platformConnectionRecipes.ts`](../base44/shared/platformConnectionRecipes.ts).
Request input names to validate against the parser: `connection_id`, `platform`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`routeAgentTask`** — [`entry.ts`](../base44/functions/routeAgentTask/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/subscriptionEntitlements.ts`](../base44/shared/subscriptionEntitlements.ts); [`base44/shared/auditLog.ts`](../base44/shared/auditLog.ts).
Request input names to validate against the parser: `campaign_id`, `capability`, `context_summary`, `delegation_id`, `mode`, `objective`, `source_agent`, `target_agent`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`runBrowserConnection`** — [`entry.ts`](../base44/functions/runBrowserConnection/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts).
Request input names to validate against the parser: `action`, `connection_id`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`runOfficialSocialPromotion`** — [`entry.ts`](../base44/functions/runOfficialSocialPromotion/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`runOutreachAgent`** — [`entry.ts`](../base44/functions/runOutreachAgent/entry.ts).
Direct local dependencies: [`base44/shared/featureFlagGate.ts`](../base44/shared/featureFlagGate.ts); [`base44/shared/subscriptionEntitlements.ts`](../base44/shared/subscriptionEntitlements.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts); [`base44/shared/writingGuidance.ts`](../base44/shared/writingGuidance.ts).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`runReporterDiary`** — [`entry.ts`](../base44/functions/runReporterDiary/entry.ts).
Direct local dependencies: [`base44/shared/writingGuidance.ts`](../base44/shared/writingGuidance.ts).
Request input names to validate against the parser: `length`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`runSocialAutopilot`** — [`entry.ts`](../base44/functions/runSocialAutopilot/entry.ts).
Direct local dependencies: [`base44/shared/featureFlagGate.ts`](../base44/shared/featureFlagGate.ts); [`base44/shared/socialPublish.ts`](../base44/shared/socialPublish.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts); [`base44/shared/providerCapabilities.ts`](../base44/shared/providerCapabilities.ts); [`base44/shared/socialPublishingPolicy.ts`](../base44/shared/socialPublishingPolicy.ts); [`base44/shared/readEntityPages.ts`](../base44/shared/readEntityPages.ts); [`base44/shared/distributionDestination.js`](../base44/shared/distributionDestination.js).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`sendCommunication`** — [`entry.ts`](../base44/functions/sendCommunication/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/rateLimit.ts`](../base44/shared/rateLimit.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts).
Request input names to validate against the parser: `ai_generated`, `audience`, `campaign_id`, `channels`, `comm_type`, `content`, `subject`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`syncConnections`** — [`entry.ts`](../base44/functions/syncConnections/entry.ts).
Direct local dependencies: [`base44/shared/featureFlagGate.ts`](../base44/shared/featureFlagGate.ts); [`base44/shared/socialPublish.ts`](../base44/shared/socialPublish.ts); [`base44/shared/socialPublishingPolicy.ts`](../base44/shared/socialPublishingPolicy.ts); [`base44/shared/readEntityPages.ts`](../base44/shared/readEntityPages.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts); [`base44/shared/connectionVerification.ts`](../base44/shared/connectionVerification.ts); [`base44/shared/providerCapabilities.ts`](../base44/shared/providerCapabilities.ts); [`base44/shared/managedQueue.ts`](../base44/shared/managedQueue.ts); [`base44/shared/verifiedConnectionCapabilities.ts`](../base44/shared/verifiedConnectionCapabilities.ts); [`base44/shared/aiConnectionScope.ts`](../base44/shared/aiConnectionScope.ts).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`validateIntegrationHealth`** — [`entry.ts`](../base44/functions/validateIntegrationHealth/entry.ts).
Direct local dependencies: [`base44/shared/accountGuard.ts`](../base44/shared/accountGuard.ts); [`base44/shared/auditLog.ts`](../base44/shared/auditLog.ts); [`base44/shared/integrationRegistry.ts`](../base44/shared/integrationRegistry.ts).
Request input names to validate against the parser: inspect parser/delegated helper; no body/input property names found by lexical inventory.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`volunteerFollowUp`** — [`entry.ts`](../base44/functions/volunteerFollowUp/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: `signup_id`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.

**`welcomeVolunteer`** — [`entry.ts`](../base44/functions/welcomeVolunteer/entry.ts).
Direct local dependencies: none found.
Request input names to validate against the parser: `signup_id`.
Direct server runtime references: none found directly; inspect dependencies for provider/secret references.


#### Function options and channel selections to implement exactly

The following options supplement the exact per-agent allowlists. They describe the checked-in implementations, not an expanded tool grant. Bind a function only when it appears in that agent's own `tool_configs`. Parse input with a typed schema; preserve all current authorization/ownership behavior. When the current backend accepts a loose value but no supported operation is documented, do not expose arbitrary strings as new powers.

| Function | Input options and integration behavior |
| --- | --- |
| `generateIntelligence` | `mode: opportunities` selects source-backed opportunity discovery; the other/default path produces a strategic MissionBrief and recommendations. This model-backed function is not a free deterministic lookup. Current account/subscription/rate/budget gates must pass. The prompt identities “Opportunity Discovery Agent” and “Mission Control” are internal generation roles, not extra provisioned chat agents. |
| `getAgentAccountContext` | No caller-selected owner argument. Identity derives from the request. Returns scoped campaigns, redacted connections, profile, followed campaigns, own posts, distributed posts, memberships, actual recorded likes/saves, delegations and drafts. `data_complete:false` plus `data_unavailable_sources` must remain visible to reasoning; unavailable data is not an empty-account fact. |
| `getWritingResearchBrief` | No caller-supplied user/brief selector. Requires eligible AI writing subscription; returns latest `verified_sources` brief or `available:false`. Retain week, source URLs, unverified claims and reminder that general research is not campaign fact. |
| `listFundraisingProviderCapabilities` | No caller-selected owner argument. Active authentication required; shared resolver returns `providers` plus `registry_version`. A catalog capability is not that user's provider authorization. |
| `discoverConnectionMethods` | `platform` must match the normalized platform identifier grammar; `operation` is `connect` (default), `read_metrics`, `publish` or `account_create`; `subject` is `member` (default) or restricted `platform_owner`. Returned transport candidates are `oauth`, `api`, `webhook`, `token`, `authenticated_browser`, `public_browser`, `manual`. Registration presence/can_attempt is not provider-policy verification or successful access. |
| `getVerifiedIFundIntegrationContext` | Valid `platform`, `subject: member|platform_owner` with separate owner gate. Returns a redacted runtime snapshot. Current unknowns include verified production origin, OAuth redirects, provider app ID, support contact, provider policy and allowed capabilities. Despite its name it currently reports those unknown fields and does not authorize mutation. |
| `listConnections` | Optional `scope: all` selects the cross-account view only when the current authenticated role is admin; otherwise the source returns only the caller’s records (up to 300). Default/other scope remains personal. Do not implement an “all users” mode for a member from this field. Credential redaction and caller ownership are mandatory even when an agent has PlatformConnection read selection. |
| `resolveConnectionStatus` | Optional `platform`/`connection_id` selectors with current account/ownership handling. Preserve source distinctions including `NOT_CONNECTED`, `AUTHORIZATION_REQUIRED`, `RECONNECT_REQUIRED`, `DEGRADED`, `CONNECTING`, `BLOCKED`, and any successful state returned by the source. Status resolution cannot fabricate provider verification. |
| `runBrowserConnection` | Current request gate permits only `GET_METRICS` or `CHECK_STATUS` with `connection_id`; it requires an owned crowdfunding connection, owned linked campaign and active unified OBO consent, then deliberately returns 503 `browser_execution_deferred` with provider verification false and no external browser request. Neither `POST`, arbitrary URL navigation nor arbitrary browser commands become supported by selecting a browser skill. |
| `sendCommunication` | `campaign_id`, nonempty `subject`/`content`, nonempty `channels`; supported channel behavior is `email` and `in_app`. `audience: recurring_donors` filters recurring supporters; default recorded audience is `campaign_donors`. `comm_type` defaults to `update`; `ai_generated` retains actual provenance. Exact audience selection, verified recipient pool, opt-out preferences and per-channel success/failure come from the backend. No arbitrary address list or broadcast-all grant is introduced. |
| `manageAgentContentDraft` | `list`, `create`, `revise`, `cancel`; eight kinds and allowed payload keys are documented above. `source_agent` must be a registered draft-capable role; Finance/admin builder are not in the source allowlist. Scope IDs are clipped and checked. `focus_campaign_ids` is an array capped at six, `ai_profile` is an object capped at 5000 serialized characters, nonnegative finite `goal_amount`, status `draft|active|paused|completed`, and profile visibility flags are booleans. Main text limits: body/story 12000, content 10000, summary 1000, other string fields 500; preserve exact code for all conditional requirements. |
| `routeAgentTask` | Modes `dispatch` (default) and `status`; see the complete capability mapping below. Dispatch requires different valid source/destination agents and a concrete objective. Status reads only the caller's delegation. Informational versus consequential completion differs; never promote a consequential answer to completed merely because the model replied. |
| `requestManagedConnectionAction` | `connect`, `create_account`, `repair`, `reauthorize`; current feature, level-2 subscription, unified consent version, per-connection OBO, provider recipe and owned resource checks. Action input does not authorize account creation when transport remains manual/waiting. |
| `getStripeIntegrationAudit` | Existing admin-only audit, no member privilege via Outreach selection. Inspect configured backend provider/runtime prerequisites without exposing credentials; an audit result does not activate retired purchase routes. |
| `repairStripeWebhookEvents` | Existing admin-only provider mutation with the backend's exact endpoint allowlist and event policy. Not a general webhook-management tool; no ordinary-user invocation or side-effect “test” is permitted. |
| `manageAdminBuilderWork` | `list` (default), `queue`; only the authenticated super-admin owner. Queue validation and requested/implemented:false result are documented above. No execute/deploy/shell mode exists. |
| `managePlatformIncidents` | `report` (default), `list`, `save_plan`, `reject`, `approve`. Public/login error `report` is untrusted intake, not privileged control. All privileged modes independently require super-admin. `save_plan` uses `incident_id`, `analysis` (1600), `systemic_scope` (1600), `repair_plan` (2800), `verification_plan` (1400), `rollback_plan` (1000); reject/approve use the exact incident and bounded `note` (500). Preserve status and reapproval/dispatch guards. Reporting kind/source/route/code allowlists are in source; do not execute report text. |

Registered delegation capabilities:

| Capability option(s) | Exact target |
| --- | --- |
| `strategy`, `planning` | `strategy_agent` |
| `growth`, `analytics` | `growth_agent` |
| `communications`, `messages` | `communications_agent` |
| `writing`, `story` | `story_agent` |
| `finance`, `donations` | `finance_agent` |
| `outreach`, `publishing` | `outreach_agent` |
| `connections`, `connection_repair` | `managed_connection_agent` |
| `discovery`, `research` | `connection_discovery_agent` |

Unknown capability, mismatched target, same source/target and builder delegation must be rejected. The current duplicate lookup reuses matching active work but is not proof of atomic concurrency safety; a Cloudflare executor still needs durable unique operation claims.

#### Names, aliases and non-chat roles

Use the exact JSONC identity in conversation creation, not the historical alias. Current alias resolution in `src/lib/agentIdentity.js` maps Chief of Staff to `solene`, Strategy to `post_production`, Story to `donor_relations`, Growth to `scout`, Communications to `platform_coordinator`, Finance to `finance`, and Outreach to `atlas`. Discovery, Managed Connections and admin builder use normalized names when no explicit map entry exists. These are continuity identifiers, not different chat permissions or additional agents. Do not add duplicate “Atlas,” “Scout,” “Mission Control,” “Reporter,” “Official Editor,” “Platform Steward” or historical `builder_agent` configurations just to match labels. Reporter/editor/steward behavior is covered by the workflow chapters; historical deferred builder access is separately governed by `docs/deferred-admin-builder-agent.md`.

#### Credentials, scopes and skill resolution worksheet

For each selected remote skill, record its exact selected ID/name, authenticated workspace owner, title, content hash/version, provenance, associated connector/provider, supported input/output contract, required role, required provider scopes, revocation behavior, model/data exposure, current grant state, cost limit, verification result and rollback reference. Never record credential values. A skill whose content/grant cannot be inventoried stays unresolved and blocks the capability that depends on it; it is not replaced by a similarly named local Markdown file.

For each external provider, record public developer app reference, actual allowed redirect URI/origin, requested versus granted scopes, read/post/message/comment capabilities separately, subject (`member` or `platform_owner`), current owner/grant/expiry, approved action/cadence, protected credential reference, verification evidence and disconnect/revoke procedure. Install no provider, widen no OAuth scope and submit no test publish automatically just to fill this worksheet. Configuration-only, verified read, verified publish and ledger credit remain different states.

For each worker, record the exact service/account/environment, route/service-binding names, consumed setting names from the inventory, protected secret-reference owner, version/rotation policy, downstream endpoint identity, allowed principals, expected request/response/content type, observed status, test fixture and previous configuration version. Verify that every actual route is served by the intended compute handler and that a missing endpoint returns an error instead of the frontend shell.

### Connecting to interplanetaryfund.com and release evidence

#### Live account and DNS preparation

Use an authorized Cloudflare connection; do not paste access tokens into chat or source. An operator must verify the exact account, zone, Worker identity and permitted plan before deployment. At the time of this documentation, no live account/zone/Worker state was reverified. Source comments and older DNS findings are historical evidence only. Verify current authoritative nameservers, zone status, apex/www records, proxy status, MX/TXT/SPF/DKIM/DMARC, existing routing and callback URLs. Preserve every unrelated service record.

A Worker route only intercepts traffic if the relevant hostname reaches the active Cloudflare zone/proxy. A `workers.dev` deployment does not prove `interplanetaryfund.com` routes to it. Prepare a DNS export and rollback with the authorized owner before any domain-wide change. Do not copy historical nameserver assignments as current instructions: use the nameservers assigned to the exact current zone. DNS/registrar authorization is separate from repository write permission.

#### Deploy in stages, one worker and agent at a time

1. Capture protected backups of the current Worker versions/configuration, canonical agent config/remote skill inventory and relevant active scheduler state. Record references/hashes, not secret contents. Confirm no competing deployment or overlapping workflow is running.
2. Validate the repository checks. Use the authorized website pipeline for frontend assets; this documentation task does not run a build or publish a site. The platform’s normal source validation and explicit release process remain in force. Do not trigger Android builds.
3. Select the correct Wrangler config in any future deployment command. Root `wrangler.toml` is the public gateway/site; `host/workforce/wrangler.toml`, `host/workflows/wrangler.toml` and `host/email/wrangler.toml` are distinct services. The historical `host/gateway/wrangler.toml` is not a substitute for root config. Standalone OAuth lacks deployment config and is blocked pending review. Review `scripts/publish-ifund-cloudflare.sh` and `.github/workflows/deploy-cloudflare.yml` before using them; they may build, deploy or call live endpoints. Do not run them merely to inspect configuration.
4. Deploy inspection-only preview resources first through the authorized deployment tooling. Re-read deployed variables/bindings/routes without printing secret values. Verify every required server secret is configured and its permission is suitable; “present” is not proof of validity.
5. Exercise positive/negative auth and fixture tests at the actual preview host. Unknown agent/tool names, invalid sessions, revoked grants and absent backend config must fail closed. Never route a missing API to the SPA HTML fallback.
6. Deploy only the source-verified gateway changes needed to preserve existing Base44 execution. Independently verify `https://interplanetaryfund.com/api/health` and the equivalent `www` path produce the expected JSON/content type. Test MCP discovery/issuer consistency and protected routes with authorized test identities. Do not issue live inference or public posts until the approved budget and consent gates pass.
7. Complete one agent’s chapter and a bounded shadow comparison. Verify exact skills/model/owner context, memory behavior, tool permissions, real conversation lifecycle and truthful outcomes on the published revision. Promote only that agent/action using a reviewed reversible configuration change. Record the exact switch/route/adapter implementation; no per-agent Cloudflare production switch currently exists to toggle.
8. Activate related workflows individually only after single-executor reconciliation and live evidence. A test request accepted by Cloudflare is not proof that the downstream backend/provider acted. Verify resulting records/provider receipts and prove repeated identical requests do not cause duplicate effects.
9. Observe a bounded interval with error/budget/deduplication monitoring. Stop new actions on access, privacy, financial, consent or duplicate-write failures. Reconcile uncertain results before resuming. Do not continually retry after three materially different failures; record the blocker and proceed with independent safe work.
10. Preserve Base44 production until the separately verified reversible cutover is explicitly authorized. Successful Cloudflare deployment does not establish independence from Base44 auth, persistence, agent runtime, OAuth, storage or scheduled tasks.

#### Troubleshooting choices

| Observation | Required diagnosis and action |
| --- | --- |
| HTML returned at `/api/health`, agent REST or MCP path | Confirm authoritative DNS, proxy/route matching, correct Worker version and `run_worker_first`; do not interpret SPA 200 as API success |
| 503 from workforce/workflows | Expected while execution is disabled/missing. Inspect readiness and implement required adapters; a flag alone is not a fix |
| Admin denied | Check actual session/owner role, exact allowed origin, key/session configuration and gateway/backend target allowlists. Do not relax super-admin checks |
| Agent missing from member selector | Check exact stable name, actual deployed config, subscription and role; builder is intentionally separate |
| Tool is selected but denied | Inspect backend ownership/admin/feature/OBO guards. Prompt or skill selection cannot override them |
| Skill ID cannot be resolved | Preserve its ID/order; inventory the authorized remote workspace. Do not invent or replace a skill |
| Provider credential saved but still disconnected | Correct until real permitted provider evidence proves capability; never set connected/last_synced from acknowledgement |
| Job resumed after revoked consent | Deny/cancel at execution-time guard; do not use cached grant or old memory |
| Public post timed out | Mark uncertain, reconcile provider receipt first; do not auto-retry |
| Weekly research cron looks daily | Source intentionally retries daily with UTC week-key completion/attempt guards; retain those guards and verify concurrency before activation |
| Email appears in wrong inbox | Stop the changed routing rule; verify recipient-class isolation and receiver grants before resuming; never forward private mail to organizational inbox |
| Configuration exists only in an app ZIP | Retrieve through its authorized artifact source, hash/inventory it, compare each definition to canonical source; do not silently create additional agents from aliases |

#### Completion record for each worker, agent and workflow

Record all of the following before marking an item operational: canonical source paths and revision; exact deployed resource/account reference; chosen execution mode; configuration/skill hashes and resolved versions; model/budget approval and safe limits; owner/campaign/role entitlement proof; schema/RLS and tool/API contracts; selected provider capabilities and separate grants; event/schedule/delay/timezone state; idempotency and replay/cancellation evidence; direct API negative-auth tests; positive fixture results; source versus hosted test results; real provider outcome where relevant; outstanding blockers; prior version and precise rollback steps; reviewer and verification timestamp. Reference protected evidence rather than copying secrets or private content.

This manual is complete for the ten agent definitions, seventeen workflow definitions and five Worker entrypoints present in the inspected checkout. The linked canonical prompt strings and full role guides are required parts of the instructions, not optional substitutes. Exact live endpoint URLs, remote skill bodies/grants, account resource IDs, provider permissions, active schedule state and model/billing eligibility must be recovered from their authoritative live sources. Their absence is a documented implementation prerequisite, never a value to invent.
