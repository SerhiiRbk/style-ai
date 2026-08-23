-- Snapshot of Carlo's look at first constructor Apply, so the owner can
-- restore title / brief / image / shop without regenerating.
-- Owner-only jsonb (same as archived_images / look_items) — not on the
-- public look_sets whitelist.

alter table public.look_sets
  add column if not exists original_looks jsonb not null default '{}'::jsonb;
