# Base44 Admin Moderation Gates

Status: implementation handoff and release gate. This document does not claim Development or Production validation.

## Safe slice currently authorized

The current branch may add only source-grounded safeguards that do not guess Base44 runtime capabilities:

- privileged queue reads must come from an authenticated server-side projection;
- pause/restore moderation actions must be allowlisted server-side and must not be direct browser entity mutations;
- payout approval/denial remains Draft until a supported atomic single-winner claim/fence and durable idempotency primitive are identified and tested;
- provider-unknown and reconciliation-pending states must remain visible and must not be collapsed into success or failure.

## Required server boundary

The moderation surface must derive the authenticated actor and role server-side. Client-supplied role, actor, campaign, or outcome fields are untrusted. The server action must enforce:

1. authenticated active account;
2. admin/fraud-review role for fraud-held withdrawal decisions;
3. bounded non-enumerating errors for nonexistent, unrelated, and cross-campaign targets;
4. allowlisted action names (`pause`, `restore`, and any future moderation action explicitly implemented);
5. immutable audit evidence with actor, action, target, reason, prior state, resulting state, timestamp, and idempotency key.

## Evidence gate

Do not mark this slice complete or request merge until the exact branch head includes:

- the real server projection/action implementation;
- exact-head Node 24 checks;
- authorization-negative tests for anonymous, unrelated, owner/operator, forged-role, and cross-campaign callers;
- replay and duplicate-action tests;
- Development runtime evidence for concurrent moderation requests and stale-worker fencing;
- fresh Agent 2+3 review and Agent 3 final review.

## Source-of-truth rule

No Convex or Production behavior may be changed from this branch without an authoritative deployed-versus-source reconciliation. The five reported Convex automation functions and shared `cron_commit_mut...` writers are not visible in the accessible repository source at this checkpoint, so they remain outside this implementation slice.
