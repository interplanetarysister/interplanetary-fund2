# IFund Supabase workflow queue — live implementation

Project: `tzehxfikoslihnclhxuz` (Ifund, us-west-2).

Applied migration: `ifund_private_workflow_queue_initial`.

The private `ifund_ops` schema contains `workflow_jobs`, `workflow_control`,
`workflow_execution_log`. All three have row-level security enabled, no
anon/authenticated/public table access, and no policies granting browser access.

Jobs default `paused`. A workflow cannot be enabled unless source activation,
executor correctness, and idempotency are all verified. This schema deliberately
has **no automatic trigger**, no migrated historical jobs, no scheduled execution,
and no financial or publishing function invocation.

Before live activation: verify live Base44 active schedules and pending jobs;
implement scoped, authenticated enqueue and atomic claim/lease/retry functions;
verify each worker's behavior and permissions; reconcile last successful runs;
then disable Base44 scheduling and activate Cloudflare scheduling without overlap.

## Lease fencing applied live

Migration `ifund_workflow_lease_fencing` adds a unique `lease_token` to each
claimed job. The completion RPC now requires `(job_id, lease_token, success,
error)` and rejects completion from a previous worker whose lease expired.
This prevents stale workers from changing a job's database status after another
worker reclaimed it. **It does not provide exactly-once external side effects**:
payment, publishing, and outreach adapters must independently use durable
idempotency keys and reconcile provider results before retrying.

The old unfenced completion signature was removed. Both new function signatures
were independently verified in live Supabase metadata.
