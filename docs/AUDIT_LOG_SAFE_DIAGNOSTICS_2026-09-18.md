# Audit logger safe-diagnostics boundary — 2026-09-18

## Source
Current `main` at `72a77bd7c39bf2e1a270dc14d22bc3b2ef4b4794` contained `base44/shared/auditLog.ts` logging `e.message` or the thrown value from a shared backend helper.

## Scope
- Preserve the non-throwing, best-effort audit-write contract.
- Replace raw thrown-value/message logging with a fixed low-cardinality classifier.
- Bound and redact audit metadata before persistence so sensitive provider/payment/account fields are not copied into durable audit records.
- Add an executable verifier covering Error, thrown-string, object, nullish, sensitive metadata, and long-string cases.

## Deliberate boundaries
This slice does not change audit authorization, entity schema, caller payload semantics beyond metadata bounding/redaction, provider behavior, Convex concurrency, deployment, merge, or publication.

## Review gates
- Rebaseline against exact current `main` before approval.
- Run Node 22 locked install, lint, typecheck, production build, and focused verifier with no skips.
- Review caller compatibility and whether any caller relies on unbounded metadata or raw provider detail.
- Confirm no raw exception text/object reaches console, telemetry, or persisted metadata through this helper.
