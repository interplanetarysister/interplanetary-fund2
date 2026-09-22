# Shared-surface contrast audit — 2026-09-22

## Scope
Current `main` audit of shared dark/shared-surface text styling across payment, help, connection, admin, subscription, embedded-campaign, and notification-adjacent surfaces.

## Evidence
The current source still contains `text-stone-400` in multiple audited surfaces, including:

- `src/pages/Help.jsx` — search icon, accordion icon, and status text.
- `src/pages/Discover.jsx` — search affordance.
- `src/pages/Subscriptions.jsx` — inactive billing-period label.
- `src/pages/EmbedCampaign.jsx` — progress metadata.
- `src/pages/Institutions.jsx` — search affordance.
- `src/components/LegalFooter.jsx` — footer copy.
- `src/components/NotificationBell.jsx` — bell icon / legacy route surface on current `main`.
- `src/components/giving/DonationRow.jsx` — donation metadata.
- `src/components/dashboard/StatCard.jsx` — hint text.
- `src/pages/Community.jsx` and related community/analytics/comms components — metadata and search affordances.

## Classification
This is an inventory/regression slice, not a blanket token replacement. Each occurrence must be reviewed in its actual foreground/background and semantic role before changing it. Search icons and decorative metadata may be acceptable; status, error, payment, or embedded-campaign text may require a stronger token.

## Required follow-up
1. Run the executable inventory verifier on the exact PR head.
2. Review focus, hover, disabled, error/status, payment, help, connection, admin, and embedded-campaign states.
3. Fix only confirmed contrast/semantic defects in separate focused commits, or record an explicit accepted exception with rationale.
4. Do not fold this audit into NotificationBell implementation or treat the inventory as publication evidence by itself.
