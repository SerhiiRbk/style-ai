# Catalog Attribute Typing (A-lite, Track 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans — run the tasks **strictly in order, in the main thread, one task at a time, with a review checkpoint after each**. Do not start Task N+1 until Task N is done (and, where marked, until the user has finished their stop). Do NOT delegate tasks to subagents: the tasks are small, tightly coupled (one shared vocab + `catalog.ts` internals), and a cold-start agent can re-introduce the subtleties this plan and its review thread eliminated (client-bundle boundary, double-count gate, graceful degradation). Steps use checkbox (`- [ ]`) syntax for tracking. Where a task below says "a subagent", read it as "the automated executor (the main thread)" — the prod-safety rules (never `db:migrate`, never prod writes, never kick off the rematch) bind the main-thread executor identically.

## Sequence (do not skip, reorder, or parallelize)

```
T1 vocab
  → T2 write 0045 (do not apply)
  → STOP A  user applies 0045          ← required before any row write
  → T3 toRow
  → T4 backfill script + dry-run
  → STOP B  user runs backfill --only-missing
  → T5 attrFitScore in catalog.ts
  → T6 build + harness (now the measure is real)
  → STOP C  user decides option 2 vs 3
  → T7 rematch only if option 2
```

`toRow` (T3) is **not** safe to deploy before Stop A: upserts would send columns Postgres does not have yet and break every import. `attrFitScore` (T5) *could* degrade to 0 without columns, but we still write it after the backfill so T6 measures a typed catalogue, not an empty signal.

**Goal:** Harvest typed clothing attributes (`garment_subtype`, `material_family`, `fit`, `pattern`, `season`) from data already in the catalogue (feed `attrs` / title / description) and feed them into recommendation re-ranking — improving look-to-catalogue matching at $0, with no third-party model calls.

**Architecture:** A single pure normalizer module (`scripts/feeds/attributes.mjs` + `attributes.d.mts`) is the one source of truth for the vocab. It is called (a) at ingest inside `toRow` so every new import is typed automatically, (b) by a one-off backfill over existing rows, and (c) **only on the server** inside `src/lib/data/catalog.ts` to classify a look slot into the same enums at rank time. Do **not** import the normalizer from `src/lib/style-extras.ts` — that file is pulled into the client (`StyleGuides`, report page, look constructor). Five new typed columns on `public.products` are returned by `match_product_offers` and consumed by a new `attrFitScore` term in `rankMatchRows` — a deterministic re-rank signal alongside the existing `tagFit`. The embedding vector inputs (`embedText` / `garmentQueryText`) are NOT touched (variant A: no vector-space shift, no similarity-threshold recalibration).

**Tech Stack:** Node ESM (`.mjs`) ingest scripts; TypeScript app (Next.js) for matching; Supabase Postgres + pgvector; tests via built-in `node:test` + `node:assert/strict`.

## Global Constraints

- **Variant A — vectors unchanged.** Do NOT modify `embedText` (`scripts/feeds/normalize.mjs`) or `garmentQueryText` (`src/lib/data/catalog.ts`). No re-embed, no touching `MIN_VECTOR_SIMILARITY = 0.68` / `MIN_LOOK_PICK_SCORE = 0.42` / `MIN_COLOR_MATCH = 0.4`.
- **No guessing.** A field is `null` unless confidently derivable from real data. Feed filler ("combined materials", "woven") → `null`. Never infer material from a garment noun (e.g. never `jacket` → `wool`).
- **Null contributes 0.** `attrFitScore` adds 0 for any field that is null on either the catalogue row or the brief slot — exactly like `tagFitScore` returns 0 on rows without tags. A subtype/material *mismatch* is also 0 (boost agreement only; do not penalize).
- **`fit` / `pattern` / `season` are harvested, not ranked.** Store them on the row for later tracks. `attrFitScore` uses **subtype + material only**. Do not put `season` in the score (`AW 2024 → winter` is too coarse).
- **Hard-drop is AND, not a replacement.** Keep the existing blazer-slot title filter (`isBlazerGarment` + `isTailoredBlazerTitle` in `catalog.ts` ~557–564). Add a tiny typed drop on top (`hoodie|sweatshirt|cardigan|sweater`). Never a catalogue-wide subtype filter; never delete the title filter.
- **One vocab module, server-only on the app side.** `scripts/feeds/attributes.mjs` is imported by ingest, backfill, AND `src/lib/data/catalog.ts`. No duplicated maps. No import from `style-extras.ts`. Ship `scripts/feeds/attributes.d.mts` so `tsc` can type the `.mjs` import (same pattern as `normalize.d.mts` / `upsert.d.mts`).
- **Do NOT bump `LOOK_MATCH_VERSION` in the `attrFitScore` commit (T5).** A global 10→11 is not a free line: `lookItemsNeedRefresh` treats any stored item with `matchVersion !== LOOK_MATCH_VERSION` as stale, and `matchLookItems` always calls Sonnet (`rerankLookItemSlots`). On reports that fires via `scheduleMatchRefresh` when the owner opens; on look sets it is **on-request** in `ensureSetLookItems`. Decision is Stop C after T6, then T7 if at all.
- **No vision, $0 external.** This track makes zero model calls. The later rematch (T7), if chosen, is user-run and rate-limited — the executor never kicks it off.
- **User-owned DB writes sit on the critical path, not off to the side.** The executor NEVER runs `db:migrate`, NEVER runs the backfill against prod, NEVER issues DB writes to prod. It writes the SQL (T2) and the script (T4), then **stops** and waits. T3 must not be deployed until Stop A. T5/T6 must not be treated as a lift verdict until Stop B.
- **Verify every task** with `npx tsc --noEmit` and `npx eslint <changed files>`; T6 also runs `npm run build`.

---

## Vocabulary (finalized — validated on a 20/brand dry-run)

Enums (the ONLY allowed values; anything else → `null`):

- **material_family:** `wool, cotton, linen, denim, leather, suede, silk, viscose, corduroy, tweed, velvet, fleece, canvas, technical`
- **fit:** `slim, tailored, regular, relaxed, oversized`
- **pattern:** `solid, stripe, check, houndstooth, herringbone, floral, paisley, camo, graphic, textured`
- **season:** `summer, winter, transitional, all_season`
- **garment_subtype:** menswear *garment* nouns (blazer, shirt, shorts, overshirt, … — see `SUBTYPE_MAP` in Task 1); `null` when the title carries no known garment noun. Prefer **product-level** nouns over pocket/style fragments (`cargo` is a pocket, not a subtype). `crossbody` is fine for bags.

Source priority for material/fit/pattern: **feed `attrs` → title → description** (feed structured data beats free text). `season` comes only from `attrs.season` (e.g. Reserved `"SS 2026"`). `garment_subtype` comes from the title (fallback description).

**Matching rules inside a single string:**

- **Longest-match on subtypes.** Scan `SUBTYPE_MAP` keys longest-first so `"Shirt Jacket"` / `"Overshirt"` become `jacket` / `overshirt`, never `shirt`.
- **Blends pick the more distinctive fiber**, not the first token. Priority (high → low): `leather, suede, linen, silk, wool, tweed, corduroy, velvet, denim, canvas, technical, viscose, fleece, cotton`. So `attrs.material = "cotton, linen"` → `linen` (and a "Linen Rich Shirt" title agrees). Unknown / filler tokens are skipped.

---

## Task 1: Pure attribute normalizer + vocab (`attributes.mjs`)

**Files:**
- Create: `scripts/feeds/attributes.mjs`
- Create: `scripts/feeds/attributes.d.mts` (export types for `parseProductAttributes`, each `norm*`, `ATTR_TYPING_VERSION`)
- Test: `scripts/feeds/attributes.test.mjs`

**Interfaces:**
- Produces:
  - `parseProductAttributes(p) → { garment_subtype, material_family, fit, pattern, season }` where `p` has `{ attrs?, title?, description?, category? }`. Every value is an allowed enum string or `null`.
  - `normMaterial(text) → string|null`, `normFit(text) → string|null`, `normPattern(text) → string|null`, `normSubtype(title) → string|null`, `normSeason(attrsSeason) → string|null` (exported for `catalog.ts`).
  - `ATTR_TYPING_VERSION = 1` (bumped when the maps change; drives backfill `--only-missing`).

- [ ] **Step 1: Write the failing test**

```js
// scripts/feeds/attributes.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { parseProductAttributes, normMaterial, normSubtype } from "./attributes.mjs";

test("Reserved attrs are harvested, filler → null", () => {
  const r = parseProductAttributes({
    title: "Regular Fit Linen Rich Shirt",
    description: "Regular fit shirt made of linen rich fabric with cotton blend.",
    category: "Shirts",
    attrs: { fit: "regular", pattern: "plain design", material: "cotton, linen", season: "AW 2024" },
  });
  assert.deepEqual(r, {
    garment_subtype: "shirt", material_family: "linen", fit: "regular",
    pattern: "solid", season: "winter",
  });
  // "combined materials" is filler, not a fiber → null (no guessing)
  assert.equal(normMaterial("combined materials"), null);
});

test("ZARA bare title → subtype + partial material, no guessing", () => {
  const r = parseProductAttributes({
    title: "Regular Fit Textured Shirt", description: "REGULAR FIT TEXTURED SHIRT",
    category: "Shirts", attrs: { material: null },
  });
  assert.equal(r.garment_subtype, "shirt");
  assert.equal(r.material_family, null);   // never guess cotton from "shirt"
  assert.equal(r.fit, "regular");
  assert.equal(r.pattern, "textured");
});

test("subtype from title nouns — longest match, garment-level", () => {
  assert.equal(normSubtype("Relaxed Fit Double-Breasted Blazer"), "blazer");
  assert.equal(normSubtype("100% Linen Cargo Bermuda Shorts"), "shorts");
  assert.equal(normSubtype("Relaxed Fit Overshirt"), "overshirt");
  assert.equal(normSubtype("Cotton Shirt Jacket"), "jacket");
  assert.equal(normSubtype("Leather Crossbody Bag"), "crossbody");
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `node --test scripts/feeds/attributes.test.mjs`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Implement `attributes.mjs` + `attributes.d.mts`**

Use the maps validated in the dry-run (material/fit/pattern/subtype/season). Copy the `MATERIAL_MAP`, `FIT_MAP`, `PATTERN_MAP`, `SUBTYPE_MAP`, `FILLER`, `normSeason` as prototyped, with these required deviations:

- `normSubtype`: sort keys by length descending before scanning (longest-match).
- Drop pocket-only keys that collide with a real garment (`cargo` must not beat `shorts`).
- `normMaterial`: skip filler; on a comma/slash list pick the highest-priority distinctive fiber (see Vocabulary). A single known fiber still wins.

```js
export const ATTR_TYPING_VERSION = 1;

// pick with source priority attrs > title > desc
function firstNonNull(candidates) {
  for (const v of candidates) if (v) return v;
  return null;
}

export function parseProductAttributes(p) {
  const title = p.title || "";
  const desc = p.description || "";
  const a = p.attrs || {};
  return {
    garment_subtype: normSubtype(title) ?? normSubtype(desc),
    material_family: firstNonNull([normMaterial(a.material), normMaterial(title), normMaterial(desc)]),
    fit: firstNonNull([normFit(a.fit), normFit(title), normFit(desc)]),
    pattern: firstNonNull([normPattern(a.pattern), normPattern(title), normPattern(desc)]),
    season: normSeason(a.season),
  };
}
```

(`normPattern` returns `null` for a bare "patterned" — we know not-solid but not which, so no guess.)

- [ ] **Step 4: Run tests — expect pass**

Run: `node --test scripts/feeds/attributes.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint & commit**

```bash
npx eslint scripts/feeds/attributes.mjs scripts/feeds/attributes.test.mjs
git add scripts/feeds/attributes.mjs scripts/feeds/attributes.d.mts scripts/feeds/attributes.test.mjs
git commit -m "feat(catalog): pure attribute normalizer + vocab (attributes.mjs)"
```

---

## Task 2: Migration — typed columns + RPC (0045)

**Files:**
- Create: `supabase/migrations/0045_product_attribute_typing.sql`

**Interfaces:**
- Produces columns on `public.products`: `garment_subtype text, material_family text, fit text, pattern text, season text, attr_typing_v smallint`.
- `match_product_offers(...)` returns the five typed columns (consumed in Task 5).
- No CHECK constraints on the enums — the normalizer is the gate. Last RPC rewrite was `0026` (0029 did not touch it); copy that body, same 7-arg signature.

- [ ] **Step 1: Write the migration** (mirrors `0026_product_style_tags.sql` — add columns, then `drop function` + `create or replace function` re-declaring `match_product_offers` with the new return columns; copy the 0026 body verbatim and add `p.garment_subtype, p.material_family, p.fit, p.pattern, p.season` to the `select` and the `returns table (...)` list).

```sql
-- Typed clothing attributes harvested at ingest from feed attrs/title/description
-- (scripts/feeds/attributes.mjs). Feed the deterministic re-rank (attrFitScore)
-- alongside the existing formality/trend/versatility tags from 0026. No vision.
alter table public.products
  add column if not exists garment_subtype text,
  add column if not exists material_family text,
  add column if not exists fit text,
  add column if not exists pattern text,
  add column if not exists season text,
  add column if not exists attr_typing_v smallint;

-- Re-declare match_product_offers to return the new columns. Body is 0026's
-- verbatim + the five p.<col> in select and in returns table(...).
drop function if exists public.match_product_offers(
  vector, int, text, numeric, text, text, text
);
create or replace function public.match_product_offers(
  query_embedding vector(1536),
  match_count int default 8,
  filter_category text default null,
  max_price numeric default null,
  gender_filter text default null,
  p_country text default 'Global',
  p_currency text default 'EUR'
)
returns table (
  id uuid, source text, brand text, title text, category text, color text,
  color_hex text,
  formality smallint, trend_level smallint, versatility smallint,
  garment_subtype text, material_family text, fit text, pattern text, season text,
  price_eur numeric, price_native numeric, currency text,
  deeplink text, image_url text, market text,
  offer_country text, same_country boolean, similarity float
)
language sql stable security definer set search_path = public as $$
  -- << copy 0026 body; add p.garment_subtype, p.material_family, p.fit,
  --    p.pattern, p.season to the select list next to p.formality >>
$$;
```

- [ ] **Step 2: Do NOT apply.** Verify SQL parses by eye against 0026.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0045_product_attribute_typing.sql
git commit -m "feat(catalog): migration 0045 — typed attribute columns + match_product_offers"
```

---

## Stop A — user applies migration 0045 (hard stop)

Do not start Task 3 until this is done. `toRow` will write the new columns; without 0045 every import/upsert fails.

- [ ] **User:** `npm run db:migrate` (or apply `0045_product_attribute_typing.sql` in the Supabase SQL editor).
- [ ] Confirm `products` has `garment_subtype`, `material_family`, `fit`, `pattern`, `season`, `attr_typing_v` and that `match_product_offers` returns those five fields.
- [ ] Executor waits. Task output: "Stop A done — 0045 applied. Starting Task 3."

---

## Task 3: Wire the parser into ingest (`toRow`)

**Files:**
- Modify: `scripts/feeds/upsert.mjs` (`toRow`, ~48-92; export `toRow` for the test)
- Test: `scripts/feeds/upsert.toRow.test.mjs`

**Interfaces:**
- Consumes: `parseProductAttributes`, `ATTR_TYPING_VERSION` (Task 1).
- Produces: every upserted row (API import route AND `scripts/import-feed.mjs`) carries the five typed columns + `attr_typing_v`. `toRow` is re-run on every upsert (even when the vector is preserved), so re-imports refresh the typing too.
- **Depends on Stop A.** Do not deploy this commit until 0045 is live.

- [ ] **Step 1: Write the failing test**

```js
// scripts/feeds/upsert.toRow.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { toRow } from "./upsert.mjs";
import { ATTR_TYPING_VERSION } from "./attributes.mjs";

test("toRow stamps typed attributes", () => {
  const row = toRow(
    { source: "s", externalId: "x", title: "Relaxed Fit Double-Breasted Blazer",
      category: "Outerwear", color: "beige", attrs: { material: "wool" }, deeplink: "d" },
    undefined, "feed", false,
  );
  assert.equal(row.garment_subtype, "blazer");
  assert.equal(row.material_family, "wool");
  assert.equal(row.fit, "relaxed");
  assert.equal(row.attr_typing_v, ATTR_TYPING_VERSION);
});
```

- [ ] **Step 2: Run — expect failure** (`toRow` not exported / fields absent).
Run: `node --test scripts/feeds/upsert.toRow.test.mjs`

- [ ] **Step 3: Implement.** Add `export` to `function toRow(...)`. Import at top: `import { parseProductAttributes, ATTR_TYPING_VERSION } from "./attributes.mjs";`. Inside `toRow`, after `const tags = tagsFor(p);`:

```js
  const attr = parseProductAttributes(p);
```
Add to the `row` object (next to `formality`):
```js
    garment_subtype: attr.garment_subtype,
    material_family: attr.material_family,
    fit: attr.fit,
    pattern: attr.pattern,
    season: attr.season,
    attr_typing_v: ATTR_TYPING_VERSION,
```

- [ ] **Step 4: Run — expect pass.** `node --test scripts/feeds/upsert.toRow.test.mjs`

- [ ] **Step 5: Lint & commit**

```bash
npx eslint scripts/feeds/upsert.mjs scripts/feeds/upsert.toRow.test.mjs
git add scripts/feeds/upsert.mjs scripts/feeds/upsert.toRow.test.mjs
git commit -m "feat(catalog): type products at ingest in toRow"
```

---

## Task 4: One-off backfill script

**Files:**
- Create: `scripts/backfill-product-attributes.mjs`

**Interfaces:**
- Consumes: `parseProductAttributes`, `ATTR_TYPING_VERSION`.
- CLI: `--dry-run` (print sample, no writes), `--only-missing` (rows where `attr_typing_v` is distinct from current), `--limit N`, `--force` (all rows). Idempotent. Paginates. Loads env like other scripts (`node --env-file=.env.local`).
- **The executor runs it ONLY with `--dry-run --limit 20` (read-only). The full prod run is Stop B (user).**
- **Depends on T1 + Stop A.** After Stop A the new columns exist, so the dry-run can show before→after including current `attr_typing_v`.

- [ ] **Step 1: Implement** the script: page `products` (id, title, description, category, attrs, attr_typing_v), run `parseProductAttributes` per row, and in non-dry-run `update` the five columns + `attr_typing_v = ATTR_TYPING_VERSION` in batches. `--only-missing` filters `attr_typing_v is distinct from N`. `--dry-run` prints a before→after sample and per-field coverage, writes nothing. Mirror the connect pattern of existing scripts (service-role client from env; never print secrets).

- [ ] **Step 2: Dry-run smoke (read-only)**

Run: `node --env-file=.env.local scripts/backfill-product-attributes.mjs --dry-run --limit 20`
Expected: prints 20 before→after rows + coverage; exits 0; writes nothing.

- [ ] **Step 3: Commit**

```bash
npx eslint scripts/backfill-product-attributes.mjs
git add scripts/backfill-product-attributes.mjs
git commit -m "feat(catalog): backfill-product-attributes script (dry-run/only-missing/limit/force)"
```

---

## Stop B — user backfills existing products (hard stop)

Do not start Task 5 until this is done. T5/T6 need typed rows in the catalogue; otherwise `attrFitScore` is all zeros and the harness cannot show lift.

- [ ] **User:** `node --env-file=.env.local scripts/backfill-product-attributes.mjs --only-missing`
- [ ] Confirm a non-trivial share of rows have `attr_typing_v = 1` and some `garment_subtype` / `material_family` populated (ZARA material may stay null — that is expected).
- [ ] Executor waits. Task output: "Stop B done — products typed. Starting Task 5."

---

## Task 5: Server-side slot classification + `attrFitScore` re-rank

**Files:**
- Modify: `src/lib/data/catalog.ts` only (`MatchRow` ~50; `rankMatchRows` ~526; the `match_product_offers` result mapping; `attrFitScore`; hard-drop AND). **Leave `LOOK_MATCH_VERSION` at 10.**
- Create: `scripts/feeds/attributes.d.mts` if Task 1 did not already
- Test: `src/lib/data/catalog-attrfit.test.ts`
- **Do not modify `src/lib/style-extras.ts`.** `LookGarment` stays as-is. Classify the slot in `catalog.ts` from `garment` + optional `clause` via `normSubtype` / `normMaterial`.

**Interfaces:**
- Consumes: `normSubtype`, `normMaterial` from `../../scripts/feeds/attributes.mjs` (server-only; `catalog.ts` already has `import "server-only"`).
- Helper (local to `catalog.ts`, not on `LookGarment`):
  ```ts
  function slotAttrs(garment: string, clause?: string | null): {
    subtype: string | null;
    material: string | null;
  }
  ```
  `subtype = normSubtype(clause || garment) ?? normSubtype(garment) ?? null`  
  `material = normMaterial(clause || "") ?? normMaterial(garment) ?? null`  
  Constructor briefs like `navy wool double-breasted blazer` / `brown suede loafers` will populate `material` here.
- `MatchRow` gains `garment_subtype?, material_family?, fit?, pattern?, season?` (all `string | null`). `fit`/`pattern`/`season` are mapped through for later use; they do **not** enter the score.
- New `attrFitScore(row, slot, garmentScore)` — see Step 3.
- `LOOK_MATCH_VERSION` stays **10**. New matches still write `matchVersion: LOOK_MATCH_VERSION` (unchanged). A v11 bump is Task 7, only after Stop C.
- **Depends on T1 + Stop B.** Slot classification uses the vocab; ranking lift is only visible once products are typed.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/catalog-attrfit.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { attrFitScore } from "./catalog";

test("subtype + material match add, nulls add 0", () => {
  const base = { id: "1", title: "t", color: null, price_eur: null, deeplink: null, image_url: null };
  const slot = { subtype: "blazer", material: "wool" };
  // Weak title match → subtype bonus applies (avoids double-counting garmentTitleMatchScore).
  assert.ok(attrFitScore({ ...base, garment_subtype: "blazer", material_family: "wool" }, slot, 0) > 0);
  assert.equal(attrFitScore({ ...base }, slot, 0), 0); // row untyped → 0
  assert.equal(attrFitScore({ ...base, garment_subtype: "blazer" }, { subtype: null, material: null }, 0), 0);
  assert.ok(
    attrFitScore({ ...base, garment_subtype: "hoodie", material_family: "cotton" }, slot, 0) <
    attrFitScore({ ...base, garment_subtype: "blazer", material_family: "wool" }, slot, 0),
  );
});

test("subtype bonus is skipped when the title already matched the garment", () => {
  const row = {
    id: "1", title: "Wool Blazer", color: null, price_eur: null, deeplink: null, image_url: null,
    garment_subtype: "blazer", material_family: "wool",
  };
  const slot = { subtype: "blazer", material: "wool" };
  const weak = attrFitScore(row, slot, 0);
  const strong = attrFitScore(row, slot, 1);
  assert.ok(weak > strong);          // 0.10 subtype + 0.06 material vs material only
  assert.equal(strong, 0.06);        // title already paid for subtype via garmentScore
});
```

- [ ] **Step 2: Run — expect failure.** `node --import tsx --test src/lib/data/catalog-attrfit.test.ts`

- [ ] **Step 3: Implement**
  1. `MatchRow`: add the five optional fields.
  2. Extend the `match_product_offers` result mapping (where rows are read into `MatchRow`) to carry the new columns. `rpcMatchProducts` already casts the RPC row — new columns arrive automatically once 0045 is applied; still type them on `MatchRow`.
  3. `attrFitScore` — boost agreement only; skip the subtype term when `garmentTitleMatchScore` already fired (threshold `0.5`, same cutoff `pickBestMatch` uses for a weak garment hit):

     ```ts
     export function attrFitScore(
       row: MatchRow,
       slot: { subtype: string | null; material: string | null },
       garmentScore = 0,
     ): number {
       let s = 0;
       if (slot.subtype && row.garment_subtype && garmentScore < 0.5) {
         s += row.garment_subtype === slot.subtype ? 0.1 : 0;
       }
       if (slot.material && row.material_family) {
         s += row.material_family === slot.material ? 0.06 : 0;
       }
       return s; // null or mismatch → 0; no fit/pattern/season
     }
     ```

     In `rankMatchRows`, after computing `garmentScore`:

     ```ts
     const slot = slotAttrs(garment, clause);
     const attrFit = attrFitScore(row, slot, garmentScore);
     // score += … + tagFit + attrFit
     ```

     Extend `rankMatchRows` (and `pickBestMatch` / `topRankedCandidates` callers) with an optional `clause?: string | null` so constructor/look phrases can yield material. If a caller has no clause, `slotAttrs(garment)` is enough.

  4. **Do not bump `LOOK_MATCH_VERSION`.** Leave the constant and its comment block at v10. New/regenerated looks get `attrFitScore` because they re-run `rankMatchRows`; old `look_items` keep `matchVersion: 10` and will not refresh.

  5. Hard-drop **AND** the existing title filter — do not replace it:

     ```ts
     if (isBlazerGarment(garment)) {
       const tailored = ranked.filter((r) =>
         isTailoredBlazerTitle(formatCatalogProductTitle(r.row.brand, r.row.title)),
       );
       let pool = tailored.length ? tailored : ranked;
       const KNIT_SUBTYPES = new Set(["hoodie", "sweatshirt", "cardigan", "sweater"]);
       const withoutKnit = pool.filter(
         (r) => !r.row.garment_subtype || !KNIT_SUBTYPES.has(r.row.garment_subtype),
       );
       if (withoutKnit.length) return withoutKnit;
       return pool;
     }
     ```

- [ ] **Step 4: Run — expect pass.** `node --import tsx --test src/lib/data/catalog-attrfit.test.ts`

- [ ] **Step 5: Verify types/lint & commit**

```bash
npx tsc --noEmit && npx eslint src/lib/data/catalog.ts src/lib/data/catalog-attrfit.test.ts
git add src/lib/data/catalog.ts src/lib/data/catalog-attrfit.test.ts scripts/feeds/attributes.d.mts
git commit -m "feat(catalog): typed subtype/material re-rank (attrFitScore)"
```

---

## Task 6: Full verification + measurement harness

**Files:**
- Create: `scripts/tmp-measure-attr-lift.mjs` (read-only; delete after the user measures — do not leave `tmp-` in the repo long-term)

- [ ] **Step 1: Build + typecheck + lint the whole change**

Run: `npx tsc --noEmit && npm run build`
Expected: build compiles; no type errors.

- [ ] **Step 2: Run the full unit suite touched by this plan**

Run: `node --test scripts/feeds/attributes.test.mjs scripts/feeds/upsert.toRow.test.mjs && node --import tsx --test src/lib/data/catalog-attrfit.test.ts`
Expected: all pass.

- [ ] **Step 3: Provide and run the measurement script** (read-only): given a few sample look descriptions, print the top-N catalogue matches WITH vs WITHOUT the `attrFitScore` term (deterministic `rankMatchRows` only — **no Sonnet rerank**). Stop A + Stop B are already done, so the RPC returns typed columns and the comparison is the real one — not a pre-migration smoke.

- [ ] **Step 4: Commit**

```bash
git add scripts/tmp-measure-attr-lift.mjs
git commit -m "chore(catalog): read-only attr-lift measurement harness"
```

---

## Stop C — user decides option 2 vs 3 (hard stop)

Do not start Task 7 until the user picks. The executor does not bump the version or start a rematch.

- [ ] **User** eyeballs the T6 harness:
  - **Pool actually moved** (blazer not hoodie, linen on a linen slot, fewer wrong-subtype top hits) → option 2 → Task 7.
  - **Shift is noisy or cosmetic** → option 3 → **stop the plan**. `LOOK_MATCH_VERSION` stays 10. New/regenerated content already has the lift; history is untouched; $0 extra Sonnet.
- [ ] Executor waits. Task output: "Stop C — option 2, starting Task 7" or "Stop C — option 3, plan complete."

---

## Task 7: Historical rematch — only if Task 6 said the lift is real (user-run)

This task is **gated on Stop C = option 2**. Skip it entirely when Stop C chose option 3.

**Why a bump is expensive.** `lookItemsNeedRefresh` is true when any stored item has `matchVersion !== LOOK_MATCH_VERSION`. Refresh always runs `matchLookItems` → `rerankLookItemSlots` (Sonnet). Reports: `scheduleMatchRefresh` on owner open (background, but unbounded as users trickle in). Look sets: `ensureSetLookItems` on the request path (user-visible latency). A blind global bump in the T5 commit would dump that cost onto every historical open.

**Option 2 (if Stop C said the lift is real):**

- Stop A + Stop B are already done (do not re-apply).
- Bump `LOOK_MATCH_VERSION` 10 → 11 in a **separate** commit (`v11:` typed subtype/material re-rank) — not bundled with T5.
- Then the **user** runs a rate-limited batch rematch (script or admin job, limited concurrency, known cost). Do **not** rely on on-view refresh to drain the backlog.
- A subagent never runs the batch against prod, never opens the floodgates by deploying a bump without the batch plan.

**Option 3 (if harness lift is weak):** do nothing. Version stays 10. No Task 7 commit.

- [ ] **Step 1:** Confirm Stop C chose option 2. If not, write "skipped — option 3" and stop.
- [ ] **Step 2:** Bump `LOOK_MATCH_VERSION` to 11 + `v11:` comment. Commit separately from T5.
- [ ] **Step 3:** Hand off a rate-limited rematch command / checklist to the user. Do not execute it.

---

## Self-Review

- **Spec coverage:** T1 vocab ✓; T2 SQL ✓; Stop A migrate ✓; T3 toRow (only after 0045) ✓; T4 script ✓; Stop B backfill ✓; T5 re-rank ✓; T6 harness on typed data ✓; Stop C decide ✓; T7 rematch only if option 2 ✓; single-vocab module ✓; `.d.mts` ✓; no-guessing + mismatch=0 ✓; hard-drop AND title filter ✓; `LOOK_MATCH_VERSION` left at 10 in T5 ✓; subtype bonus gated on weak `garmentScore` ✓; `fit`/`pattern`/`season` stored not scored ✓; vectors untouched ✓; `style-extras.ts` untouched ✓; strictly sequential, no parallel tasks ✓.
- **Placeholder scan:** the only intentional "copy verbatim" is the 0026 RPC body in T2 (a real, existing file to copy, not a placeholder). `norm*` maps in T1 come from the validated dry-run, plus longest-match + distinctive-fiber rules above.
- **Type consistency:** `parseProductAttributes`/`ATTR_TYPING_VERSION` (T1) used identically in T3/T4; `MatchRow` new fields (T5) match the migration columns (T2); `attrFitScore(row, slot, garmentScore)` signature consistent between its test and `rankMatchRows` usage.

## Out of scope (Track 2, later)
- ZARA material gap → `scrapper_zara` fetches composition from `product/{id}/extra-detail?ajax=true` (verified) into `attrs.material`; A-lite then types it automatically on next import. Separate repo, separate plan. Until then ZARA rows will often have `material_family = null` (honest; contributes 0).
- Using `fit` / `pattern` / `season` in `attrFitScore` (season mapping is too coarse today).
- Image embeddings / vision (dropped — not needed).
- Feeding subtype/material into the LLM reranker (`src/lib/ai/look-item-rerank.ts`) — possible future enhancement.
- Negative mismatch penalty (A-lite only boosts agreement).
