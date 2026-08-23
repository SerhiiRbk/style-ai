-- Optional aesthetic preset on a Create-a-Look set (Riviera, Nordic, …).
-- Not PII; safe on the public look_sets row. Generation still works if the
-- column is missing — the API retries the insert without it.
alter table public.look_sets
  add column if not exists style_id text;
