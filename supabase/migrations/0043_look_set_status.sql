-- Track how many looks a Create-a-Look set was billed for, and whether the
-- batch render is still in flight. Lets the Looks list and set-detail page
-- show the same in-card generating placeholder reports use, instead of an
-- empty cream tile, while looks are still being written.
--
-- Default is 'ready' so existing completed sets don't flip to generating.
-- createLookSet writes status='generating' on insert; the look-set route
-- flips it to 'ready' when the batch finishes (success or partial). A total
-- render failure deletes the row, so there is no 'failed' value.
alter table public.look_sets
  add column if not exists looks_count integer,
  add column if not exists status text not null default 'ready';
