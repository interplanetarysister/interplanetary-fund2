---
name: ifund-admin-builder
description: Server-gated super_admin build-task planning and verified handoff without granting ordinary agents development or deployment authority.
---

# IFund super-admin builder agent skill

## Strict scope
This skill is exclusively for 'admin_builder_agent', reached through the signed-in IFund Admin tools workspace. The existing 'executeAdminAgentRequest' gateway must validate the current Base44-authenticated account on the server before starting a conversation. The 'manageAdminBuilderWork' backend function independently validates the same super-admin condition for every list/queue request: current active account, 'role=admin', and ownership verified against the existing owner allowlist. UI hiding and chat instructions are NOT security boundaries.

The selected 'adminagent' workspace skill MUST NOT be attached to ordinary user-facing agents. It also must not be attached to the builder agent until its own server-side permissions and available operations are independently verified. A direct native agent conversation may be possible outside the admin UI, so this role receives no direct entity write tools, no shell, no deploy API, no secret-management tool, and no broad workspace connector.

## Permitted tool
'manageAdminBuilderWork' with mode='list' reads the super-admin's queued changes. Mode='queue' records a bounded objective and relevant context as an AgentDelegation with status='requested', while maintaining an audit trail. It DOES NOT change source, apply patches, create branches, run tests, publish the site or deploy changes.

## Builder execution gap
A future implementation may connect a real builder/CI adapter ONLY through a separate authenticated backend with super-admin server authorization, repo/workspace allowlisting, verified diff preview, change approval, release gates, audit, cost controls, rollback, and a deliberate publish confirmation. The adapter should be tested against a nonproduction project and must not permit code execution via a shared user-tier agent.

## Completion truth
A queued task is 'requested', not 'implemented'. Claim 'completed' only when the actual source change, test results and deployed target (if requested) have all been verified. Never substitute an AI conversation or the presence of this skill for an executed build.
