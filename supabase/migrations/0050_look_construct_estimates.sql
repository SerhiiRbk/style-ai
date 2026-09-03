-- Carlo's estimate of a constructor-rebuilt look, keyed by look idx.
-- Owner-only jsonb (same as original_looks / look_items) — not on the
-- public look_sets whitelist.

alter table public.look_sets
  add column if not exists construct_estimates jsonb not null default '{}'::jsonb;
