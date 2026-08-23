# Track 2 — ZARA composition scrape (close the material gap)

**Goal:** Fill `attrs.material` for ZARA products with the real outer-shell fibre from the product page, so A-lite (Track 1) types `material_family` for ZARA on the next import — closing the ~36%-of-catalogue material hole with real data, $0 model cost.

**Repo:** `~/Projects/scrapper_zara` (Python). Separate from the app repo.

## Verified facts (live)
- The category listing (`/category/{id}/products`) carries **no** composition (`detail` = `reference/displayReference/colors` only).
- `GET {BASE_URL}/product/{id}/extra-detail?ajax=true` returns a **list of sections**; the one with `sectionType == "materials"` flattens to text like `["COMPOSITION","OUTER SHELL","100% wool","LINING","65% viscose<br>35% polyester"]`.
- The current scraper never fills `material` (`material = ""` → `attrs.material = None`).
- A-lite `normMaterial("100% wool")` → `wool`; on a blend string it picks the distinctive fibre. So the scraper only needs to write the raw shell fibre string; typing happens app-side.

## Patch (scrapper_zara.py)
1. `import re`.
2. Add helpers: `_collect_text` (flatten `datatype:"text"` values), `_clean_fiber` (strip `<br>`/HTML), `_extract_composition(sections)` (OUTER-SHELL fibre → fallback first `%` line → `None` when no materials section — **no guessing**), and `fetch_extra_detail(product_id)` — a **single-attempt, best-effort** GET (0.25s politeness; returns `None` on any failure so material stays unset).
3. In `extract_product_info`, change `material = ""` → `material = fetch_extra_detail(product_id) or ""`. Runs after the `is_excluded` early-return and after `product_id` is set; dedup by id in `main()` means one PDP call per unique product.

Failure/absence → `attrs.material` stays `None` (honest). No retry storm: best-effort single attempt (not `fetch_json`'s 3× backoff), so a 404 costs one request, not ~12s.

## Run (user's — network + prod, like migrations)
1. `python3 scrapper_zara.py` → new `scrapper_zara_*.json` with `attrs.material` populated where ZARA exposes it.
2. Re-import that JSON via the app's catalog import → A-lite `toRow` types `material_family` for those rows on ingest (Track 1 already live).
3. No historical rematch needed (Task 7 skipped): new/re-imported rows get the lift through `rankMatchRows`.

## Cost / runtime
- $0 model cost — plain HTTP.
- +1 PDP request per unique product (~5.5k) at ~0.25s politeness ≈ **20–45 min** per full run, one-time + incremental for new SKUs. Block risk mitigated by single-attempt best-effort + existing UA header; if ZARA rate-limits, raise the sleep.

## Out of scope
- Massimo Dutti scraper already reads `detail.composition` inline — no change.
- `fit`/`pattern` from the PDP (extra-detail has more sections) — could harvest later; Track 2 is material only.
