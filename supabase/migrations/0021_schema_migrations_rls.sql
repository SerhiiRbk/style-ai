-- Resolve Supabase linter 0013 (RLS disabled in public) on schema_migrations.
--
-- schema_migrations is internal bookkeeping created by scripts/db-migrate.mjs.
-- It sits in the public schema, so PostgREST exposes it. Enable RLS with no
-- policies: anon/authenticated get zero rows over the API, while the migration
-- runner (DB owner) and server (service role) bypass RLS and keep working.

alter table public.schema_migrations enable row level security;

-- Belt-and-suspenders: no API role should read/write this table directly.
revoke all on table public.schema_migrations from anon, authenticated;
