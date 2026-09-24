# welcomeVolunteer Runtime Contract

## Purpose

This document is the reviewable runtime contract for `base44/functions/welcomeVolunteer/entry.ts`. It converts the combined Agent 2+3 review findings into executable acceptance cases without guessing hosted Base44 behavior or inventing signup fields.

## Required request cases

| Case | Expected result | Must not occur |
| --- | --- | --- |
| non-POST method | `405`, `Allow: POST` | service-role client creation |
| malformed JSON | stable `400` | raw parser error in response or logs |
| primitive JSON body | stable `400` | service-role client creation |
| array JSON body | stable `400` | service-role client creation |
| missing/empty/overlong/control-character `signup_id` | stable `400` | entity lookup |
| throwing `method` or `json` getter | stable safe failure | raw getter error leakage |
| valid request + confirmed signup absence | `404` | email or notification send |
| valid request + lookup auth/provider/outage failure | safe retryable response and durable classified diagnostic | misleading `404` |
| repeated valid delivery | one logical welcome email and one logical notification at most | duplicate side effects |
| provider failure after claim | durable replay/recovery state | silent success or unbounded retry |

## Hosted evidence required before publication

1. Identify the authoritative Base44 workflow that invokes this endpoint, including trigger, payload, and retry behavior.
2. Identify the durable signup eligibility fields and the authoritative already-welcomed marker or equivalent idempotency key. Do not infer field names from the client.
3. Prove whether deduplication is owned by the endpoint, the workflow, or a durable entity transaction. If upstream guarantees single execution, provide replay evidence and document response-loss behavior.
4. Prove how lookup/auth/provider failures are classified in durable diagnostics or metrics and which failures are retryable.
5. Run the request matrix against the hosted/runtime-faithful handler boundary, including hostile request objects and repeated delivery.

## Evidence rules

- Static source verifiers are supplementary only.
- Exact-head evidence must identify the PR head SHA and the runtime/deployment identity used.
- Do not claim hosted correctness from local source inspection, static CI, or a successful build alone.
- Keep this contract separate from Convex #218/#310; those remain independent Development-first source/deployment and concurrency gates.

## Current status

- PR #440 remains Draft/open/unmerged.
- The contract is documentation-only and does not alter Base44, payment, Convex, deployment, or Production behavior.
- Agent 2+3 must verify each case and either attach executable evidence or record an explicit blocked/awaiting-hosted-evidence status.
