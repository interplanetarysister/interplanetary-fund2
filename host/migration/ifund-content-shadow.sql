-- IFund private Base44 content staging. Applied to Supabase project tzehxfikoslihnclhxuz.
-- Non-authoritative snapshots only. Never treat as proof of ownership, consent, payments, or permission.
create table if not exists ifund_migration.content_shadow (
  entity_type text not null,
  source_id text not null,
  source_payload jsonb not null,
  imported_at timestamptz not null default now(),
  primary key (entity_type, source_id)
);
alter table ifund_migration.content_shadow enable row level security;
revoke all on ifund_migration.content_shadow from anon, authenticated;
-- Intentionally no public/client RLS policies. Only trusted server-side migration processes may use these rows.
