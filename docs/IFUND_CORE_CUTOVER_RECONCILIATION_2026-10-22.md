# Replacement services and cutover evidence

Supabase project tzehxfikoslihnclhxuz already had `ifund_migration.campaign_shadow` with 22 rows and `owner_identity_map` with five rows. Preserve these existing records; do not blindly reimport or change their authority.

Applied migration `ifund_core_private_migration_staging`: private source_records, import_batches, cutover_control, all RLS protected, no public or authenticated client privileges. This staging is not production authority.

Cutover control requires three verified conditions per service: destination parity, frozen source, reconciliation. All default false. Financial records and payouts remain on existing authoritative service until independently reconciled. Live workflow execution stays disabled. Avoid switching DNS or payments without final live tests.

Pending: authenticated replacement API, Supabase Auth ownership reconciliation, file storage and image migration, payment webhooks and immutable ledger, external connection authorization, agent runtime, source event cursors, live functional tests, verified source freeze and DNS route switch.
