# Deferred admin Builder Agent

## Capability

Administrators need an in-app assistant that can inspect operational evidence,
diagnose defects, and preserve a repair plan without changing payments,
permissions, ownership, credentials, or production source directly.

## Why it is deferred

Base44's agent conversation API currently requires authentication, but the
repository has no verified, non-bypassable way to restrict a named agent to the
`admin` role. A role check in the Platform page or chat component protects only
that user interface. An authenticated non-admin could still call the agent API
directly by name.

The `builder_agent` configuration and its Platform-console entry point are
therefore intentionally absent. Do not restore them based on prompt text,
`allow_anonymous_access: false`, or a client-side role check; none of those is
server-side authorization.

## Safe restoration contract

Restore the capability only when hosted evidence proves every conversation
creation and message operation is protected by a server-enforced admin role
boundary that cannot be bypassed through the Base44 SDK or direct API calls.
The restored agent must also:

- expose only least-privilege, admin-scoped evidence;
- rely on entity rules that protect every private record independently of the
  agent prompt;
- never receive or reveal provider credentials, tokens, or payment secrets;
- require explicit confirmation before permitted state changes;
- record truthful, auditable outcomes and never claim code or deployment work
  occurred without authoritative evidence;
- keep source changes in the approved Base44/GitHub development path.

Until that contract is supported and verified, administrators should use the
existing Platform panels and repository-owned repair workflow.
