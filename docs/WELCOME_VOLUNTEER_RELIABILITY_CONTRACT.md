# welcomeVolunteer Reliability Contract

Status: implementation boundary for Issue #208; this document is not runtime completion evidence.

## Source-of-truth rule

`base44/functions/welcomeVolunteer/entry.ts` currently uses the Base44 service role to read `VolunteerSignup`, `VolunteerOpportunity`, `Community`, and `User`, then performs email and `Notification.create` side effects. The deployed/runtime contract must be reconciled before changing behavior. Do not infer a durable idempotency primitive from client code, comments, or a similarly named entity.

## Required server contract

1. **Invocation boundary**
   - Accept only the supported workflow HTTP method.
   - Parse a JSON object body.
   - Require a non-empty, valid `signup_id` with a bounded format.
   - Reject direct/anonymous invocation unless the authoritative Base44 workflow authentication contract proves it is a service-authenticated request.
   - Derive `signup.user_id`, `signup.community_id`, and all message targets from the server-loaded signup record; never trust caller-supplied user, email, community, subject, or body fields.

2. **Durable idempotency**
   - Use one durable operation key derived from the workflow event identity plus signup identity.
   - Atomically claim the operation before side effects.
   - A replay must return the stored terminal result or a truthful in-progress response; it must not send a second email or create a second notification.
   - The claim, email outcome, notification outcome, and terminal status must be retry-safe and auditable.
   - If the platform has no verified conditional-write/unique-key primitive, stop and document that limitation rather than approximating it with in-memory state.

3. **Partial failure semantics**
   - Email-provider failure is recorded as a durable failed email attempt; notification delivery must not be reported as successful unless its write succeeds.
   - Notification failure after email success must be retryable without resending the email.
   - Response-loss after completion must be safely replayable from the durable operation record.
   - Return only stable safe error classes; never serialize raw exception text, recipient addresses, message content, or record payloads.

4. **Concurrency acceptance**
   - Two concurrent deliveries for the same operation key produce at most one email and one notification.
   - A retry after a 500, timeout, or client disconnect converges on the stored operation result.
   - Different signups remain independent and do not block one another unnecessarily.

## Evidence required before promotion

- Exact-head Node 22 runtime checks for the active release baseline: install, lint, typecheck, build, and focused tests.
- Negative tests for unsupported method, malformed body, missing/invalid signup, unauthorized direct invocation, and cross-signup targeting.
- Replay/concurrency tests with provider failure, notification failure, response-loss simulation, and duplicate delivery.
- Development deployment evidence against the authoritative Base44/Convex runtime, including before/after counts for emails and notifications.
- Fresh Agent 2+3 review, Agent 1 correction/verification, and Agent 3 final publication review.

## Explicit non-claims

This contract does not claim that Issue #208 is implemented, that `welcomeVolunteer` is safe in Production, or that any current Base44 entity can serve as the idempotency store. Those claims require the evidence above.
