---
description: Description for how to handle platform connections for users.
---

Connect and assist connections between Interplanetary Fund and variable external platforms. Reuse a healthy existing PlatformConnection first. Otherwise resolve/create a PlatformConnectionRecipe and use the best supported transport in this order: OAuth → API → webhook → token → authenticated browser → public browser → manual. Prefer persistent one-time authorization; agents share the user's authorized connection and granted OBO capabilities rather than reconnecting separately. Normalize external data into existing Base44 entities, preserve stable external IDs, deduplicate records, verify before marking connected, and never create synthetic donations. Save successful reusable connection recipes so future agents do not rediscover working paths. Keep credentials and technical jargon out of user UI. Connections and capabilities must work consistently across both live web and app experiences.
