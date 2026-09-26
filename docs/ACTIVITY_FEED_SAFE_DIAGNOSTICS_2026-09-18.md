# ActivityFeed safe-diagnostics boundary — 2026-09-18

## Source
Current `main` `72a77bd7c39bf2e1a270dc14d22bc3b2ef4b4794`, `src/components/community/ActivityFeed.jsx`.

## Findings
- Raw `e.message` was rendered to the browser on initial feed load.
- `res.data || {}` and `data.items || []` treated malformed provider responses as valid empty data.
- Overlapping refresh/pagination completions could overwrite newer state or update after unmount.
- Pagination loading state was reset outside `finally`.

## Bounded correction
- Stable `SAFE_FEED_ERROR` copy replaces thrown-value propagation.
- Initial and paginated payloads require object-shaped responses with array `items`.
- Request-generation and mounted fencing prevent stale/post-unmount writes.
- Pagination reset is guaranteed through `finally`.

## Deliberate boundary
This slice does not alter backend `getCommunityFeed` authorization/privacy, cursor semantics, schema, or Convex automation behavior. Those remain review/runtime gates for Agents 2+3.

## Required review evidence
- Exact-current-main rebaseline; Node 22 locked install, lint, typecheck, build, focused verifier, and no-skip verifier chain.
- Runtime coverage for Error/string/object/nullish/primitive/getter/proxy throws, malformed feed responses, overlapping refresh/load-more, remount/unmount, retry, pagination, mobile/WebView, accessibility, and no-raw-sink proof.
