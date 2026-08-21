# Sprint 1 Draft — Implementation Review

This branch contains draft implementation changes for review. It is intentionally not merged into `main`.

## Review targets

1. **Publishing approval boundary**
   - `publishPost` now requires `DistributedPost.status === "approved"`.
   - `broadcastPosts` processes only explicitly approved posts.
   - Automation credentials cannot bypass the explicit approval boundary.

2. **Onboarding persistence**
   - Onboarding now initializes `full_name` and persists normalized onboarding data.
   - Save state is reset with `finally` so failures cannot leave the UI stuck.

3. **Communication input validation**
   - Communication requests now require an array of supported channels.
   - Unsupported channel names are rejected before any delivery occurs.

## Existing related work retained

- User entity already contains `onboarding_completed`, `onboarding`, and `comm_prefs` fields.
- PlatformConnection uses owner/admin RLS and records connection health/history.
- Direct publishing is currently implemented only for platforms with supported credential flows in this repository (Bluesky and Mastodon); unsupported platforms remain manual rather than pretending an API exists.

## Review request

Please inspect correctness, authorization boundaries, data persistence, error handling, and regression risk. Do not merge until the review/audit process is complete.
