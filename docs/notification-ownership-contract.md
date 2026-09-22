# Notification ownership and unread-policy contract

This document is the source-of-truth contract for the NotificationBell client boundary.

## Hosted ownership boundary

`base44/entities/Notification.jsonc` is authoritative for the hosted Base44 entity:

- `user_id` is required.
- Read/create/update/delete are restricted to the owning `user_id` or an admin role.
- The client must never treat `filter({ user_id })` as authorization; it is only a query hint.
- Subscription events must be accepted only when the event record has the authenticated user's `user_id` (or the server has already enforced that ownership).

## Read/unread compatibility

The deployed schema declares `read` as a boolean with a default of `false`. Client normalization therefore uses an explicit unread policy:

- missing, `undefined`, `null`, or `false` => unread
- `true` => read
- non-boolean values are malformed and must be rejected by row normalization

This policy is intentionally fail-closed for malformed rows while remaining compatible with legacy rows that predate the default.

## Required acceptance evidence

Before publication, the workflow must attach runtime-faithful evidence for:

1. cross-user reads rejected by the hosted backend;
2. cross-user subscription events rejected or absent;
3. missing/null/false/true `read` semantics;
4. remount/teardown and duplicate-subscription cleanup;
5. keyboard/focus and Android WebView behavior.

Source-level checks alone are not sufficient for release approval.
