# Google Pay Safe Diagnostics — 2026-09-18

## Source
`src/components/payments/GooglePayButton.jsx` at exact `main` `72a77bd7c39bf2e1a270dc14d22bc3b2ef4b4794`.

## Findings
- Google Pay authorization returned `err.message` to the provider callback contract.
- Provider responses were read optimistically (`order.id`, capture payload) without strict validation.
- Ambiguous capture responses could be treated as success or forwarded to `onPaid` without explicit success evidence.

## Bounded correction
- Uses stable `SAFE_PAYMENT_ERROR` for provider-facing failure responses.
- Validates plain-object config, non-empty client ID, supported mode values, non-empty order ID, and capture success evidence.
- Fails closed on malformed or ambiguous responses.
- Preserves Google Pay eligibility, cancellation/unmount cleanup, order/capture flow, amount calculation, and callback timing.

## Deliberate boundaries
This slice does not claim provider verification, durable financial claims, replay/response-loss idempotency, hosted authorization/RLS, Convex concurrency repair, Development runtime proof, merge, deployment, or Production promotion.

## Handoff
Agent 2+3 must rebaseline against exact current `main`, run Node 22 locked checks and the focused verifier, add hostile thrown-value and malformed provider-response runtime coverage, verify no raw provider text reaches Google Pay/UI/telemetry, and review payment truth semantics before any approval or publication.
