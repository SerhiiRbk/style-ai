-- Give each look a stable, content-order index so per-look products (look_items,
-- keyed by the look's position in content.looks) and look images stay aligned.
-- Previously looks were inserted in one batch (identical created_at) and read
-- back with ORDER BY created_at, whose tie-break is non-deterministic and drifts
-- after image_path updates — misaligning "Shop the look" with the rendered look.

alter table public.looks
  add column if not exists idx integer;

-- Backfill: assign a deterministic 0-based index per report. This does not
-- perfectly reconstruct the original LLM order for legacy reports, but combined
-- with a LOOK_MATCH_VERSION bump (which re-derives look_items from the now
-- deterministically-ordered looks) it restores alignment on next view.
with ordered as (
  select
    id,
    row_number() over (
      partition by report_id
      order by created_at asc, id asc
    ) - 1 as new_idx
  from public.looks
  where idx is null
)
update public.looks l
set idx = ordered.new_idx
from ordered
where l.id = ordered.id;

create index if not exists looks_report_idx on public.looks (report_id, idx);
