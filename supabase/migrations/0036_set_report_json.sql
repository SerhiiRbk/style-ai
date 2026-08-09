-- Atomic single-element update for report photo arrays.
--
-- POST /api/report-photo re-generates one grooming/hair preview (30–90s) and then
-- writes the new imagePath back. The old code read the whole array BEFORE the long
-- generation and wrote the whole array AFTER it, so two regens of *different*
-- indices started within the same ~90s window would clobber each other (lost
-- update): the second write persisted a stale copy of the array, reverting the
-- first regen's imagePath to a filename that no longer exists in storage → 404.
--
-- set_report_json() mutates only the targeted JSON path with jsonb_set at the DB
-- layer, so concurrent regens of different elements never overwrite one another.
-- Column is allow-listed to keep the dynamic identifier injection-safe.

create or replace function public.set_report_json(
  p_report_id uuid,
  p_column text,
  p_path text[],
  p_item jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_column not in ('hair', 'facial_hair', 'eyewear', 'accessories', 'headwear') then
    raise exception 'INVALID_COLUMN';
  end if;
  if p_path is null or array_length(p_path, 1) is null then
    raise exception 'INVALID_PATH';
  end if;

  execute format(
    'update public.reports set %1$I = jsonb_set(%1$I, $1, $2, true) where id = $3',
    p_column
  )
  using p_path, p_item, p_report_id;
end;
$$;

grant execute on function public.set_report_json(uuid, text, text[], jsonb) to service_role;
