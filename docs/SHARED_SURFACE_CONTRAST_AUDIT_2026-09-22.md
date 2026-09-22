# Shared-surface contrast audit — 2026-09-22

## Scope
Current-main audit of shared dark/shared-surface text styling across payment, help, connection, admin, subscription, embedded-campaign, community, analytics, communications, and notification-adjacent surfaces.

## Authoritative inventory boundary
The executable audit owns the `src/pages` and `src/components` source trees for JSX/TSX files that use the audited `text-stone-400` through `text-stone-900` foreground tokens. The fixed `auditedFiles` list records the reviewed surface inventory. The script now walks those authoritative roots and fails closed if a token-bearing JSX/TSX file is omitted, so new token-bearing surfaces cannot silently fall outside the audit.

## Evidence
The current source contains audited token occurrences in payment, help, connection, admin, subscription, embedded-campaign, community, analytics, communications, and notification-adjacent surfaces. The script emits the exact file, line, token, and source line for each occurrence.

## Classification
This is an inventory/regression slice, not a blanket token replacement or a pass/fail accessibility gate. The inventory does not calculate contrast ratios, infer foreground/background pairs, or validate rendered focus, hover, disabled, error/status, or mobile/WebView behavior. Each occurrence must be reviewed in its actual foreground/background and semantic role before changing it. Search icons and decorative metadata may be acceptable; status, error, payment, or embedded-campaign text may require a stronger token.

## Required follow-up
1. Run the executable inventory verifier on the exact PR head and retain the output.
2. Review focus, hover, disabled, error/status, payment, help, connection, admin, embedded-campaign, notification-adjacent, and mobile/WebView states.
3. Fix only confirmed contrast/semantic defects in separate focused commits, or record an explicit accepted exception with rationale.
4. Do not fold this audit into NotificationBell implementation or treat the inventory as publication evidence by itself.
5. Keep Convex #218/#310 source-to-environment reconciliation and Development-first serialization/idempotency validation as independent publication gates.
