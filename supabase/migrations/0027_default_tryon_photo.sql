-- User-selectable default photo for catalogue virtual try-on.
--
-- Catalogue try-on used to always pick the user's latest full-length upload.
-- This lets a user pin a specific full-length photo as their default "try-on
-- model". A partial unique index enforces at most one default per user; the
-- flag lives on the photo row so it disappears automatically when the photo is
-- deleted (falling back to the latest full-length upload).

alter table public.photos
  add column if not exists is_default_tryon boolean not null default false;

create unique index if not exists photos_one_default_tryon_per_user
  on public.photos (user_id)
  where is_default_tryon;
