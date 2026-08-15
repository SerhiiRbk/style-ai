-- Optional 3/4 companion image on a ready look, plus an archive of previous
-- look images so constructor Apply can keep the replaced front (and 3/4) in
-- the owner's gallery as plain pictures.
--
-- Neither column is PII. archived_images stays off the public look_sets
-- whitelist / view (owner gallery only). image_path_tq is read via the
-- admin client on the set page, same as image_path.

alter table public.looks
  add column if not exists image_path_tq text;

alter table public.look_sets
  add column if not exists archived_images jsonb not null default '[]'::jsonb;
