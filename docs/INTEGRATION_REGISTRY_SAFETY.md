# Integration Registry Safety Contract

The Base44 registry is an administrative view of provider state, not a source of provider truth.

- A new or manually reauthorized entry must remain fail-closed until a provider-backed check succeeds.
- Secret or token presence is configuration evidence only. It must never create an `ACTIVE` status or advance `last_successful_verification`. When no supported live provider probe exists, the entry remains fail-closed.
- Unknown and malformed statuses render as **Unknown**, never as Active.
- UI requests must have bounded waits, synchronous duplicate-action locks, stale-response/unmount protection, and selected-row reconciliation after refresh.
- Provider and SDK errors are logged only in bounded diagnostic form. User-visible and persisted failures use fixed safe messages.
- Convex is legacy evidence only and is not an active health requirement for the Base44 runtime.
- Verification must include negative cases for malformed responses, duplicate clicks, stale refreshes, and manual activation attempts.
