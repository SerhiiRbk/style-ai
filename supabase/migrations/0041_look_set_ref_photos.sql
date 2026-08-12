-- The reference photo(s) a Create-a-Look set was rendered on, so the whole-look
-- try-on can render on the SAME photo the set was built from — instead of
-- guessing from the user's latest photos (which could be a newer report's).
-- Stored on the owner-only side table: these are the user's own photo storage
-- paths, never exposed on the publicly-readable look_sets row.
alter table public.look_set_profiles
  add column if not exists face_ref_path text;
alter table public.look_set_profiles
  add column if not exists full_ref_path text;
