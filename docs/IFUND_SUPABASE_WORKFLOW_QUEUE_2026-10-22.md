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
