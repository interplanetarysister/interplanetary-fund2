# ExternalAccounts safe diagnostics and aggregate loading

## Source
`src/pages/ExternalAccounts.jsx` at exact current `main` `72a77bd7c39bf2e1a270dc14d22bc3b2ef4b4794`.

## Findings addressed
- Raw caught exception messages were rendered through `PageError`.
- Aggregate `listConnections`, `DistributedPost`, `Agent`, and `Campaign` responses were committed without shape validation.
- Overlapping refreshes and unmounts could allow stale completions to overwrite current admin state.

## Bounded correction
- Stable user-facing error copy only.
- Array/object response validation before state commit.
- Mounted and generation fencing for async completion.
- Existing admin role gate, retry behavior, child component contracts, and data mappings preserved.

## Deliberate boundaries
This slice does not claim hosted RLS/service-role behavior, provider correctness, Convex concurrency/idempotency, dependency updates, deployment, merge, or publication. Agent 2+3 must validate exact-head Node 22 checks, runtime hostile thrown values, malformed responses, retry/remount behavior, and admin/privacy boundaries before approval.
