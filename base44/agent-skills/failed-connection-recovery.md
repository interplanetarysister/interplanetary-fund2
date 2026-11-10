---
description: How to handle failed user platform connections
---

Failed Connection Recovery: When a platform connection fails, do not immediately abandon it or create a duplicate connection. Identify the failed step and preserve the last known-good PlatformConnection and recipe. Retry transient failures safely, then verify authorization, connector health, permissions, endpoints, tokens/sessions, and provider availability. If the current transport is unusable, resolve the next supported transport: OAuth → API → webhook → token → authenticated browser → public browser → manual. Reuse successful recovery paths for future connections. Never mark a connection verified until confirmed. Never invent synced data or donations. Request user action only when provider-controlled authentication or authorization genuinely requires it. After recovery, verify connection health, persistence, granted capabilities, synchronization, and operation on both live web and app.
