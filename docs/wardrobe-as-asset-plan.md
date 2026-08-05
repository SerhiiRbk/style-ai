# Wardrobe as an Asset — implementation plan (Valetti)

Feature: the user photographs (or imports) the clothes they already own → Valetti builds a structured, embedded "owned wardrobe" → every report, shopping list and look becomes **gap-driven** ("you already own this; buy these 3 pieces and unlock 6 new outfits") instead of a generic buy-list.

> **Amended 2026-08-03.** Six changes since the 2026-07-15 draft — the biggest is that the primary
> ingestion path is now **"I own this" from the catalogue, not photo upload**, which lets Phase 1 ship
> with no vision pipeline at all. Each amendment is marked ⚠️ inline. Rationale and sequencing tie into
> `docs/superpowers/specs/2026-08-01-valetti-growth-design.md`.

**Why this feature (product rationale)**
- Retention: turns a one-shot report into a living profile the user returns to.
- ⚠️ **Corrected competitive claim.** The original draft said "no competitor has it". That is no longer
  true: **TryDrobe is a digital closet with virtual try-on**, and there is a whole closet-app category
  (Pureple, Nouva, Dressly and others — see `docs/growth-plan.md` §1.1). The differentiator is not the
  closet; closet apps *organise what you own and generate outfits from it*, and none of them sell you
  the missing piece with a reason. Stitch Fix sells but doesn't know your closet; Zalando knows only
  its own catalogue. **What is uncontested is the combination: gap-driven purchase advice grounded in
  a colour/fit profile and a shoppable catalogue.** Position and price against that, not against
  "we have a closet feature".
- Trust: "don't buy what you already own" is the strongest possible proof of the "method, not opinion" brand promise.
- Moat: wardrobe data compounds — switching cost grows with every item uploaded.
- Monetization: makes the planned €14.99/mo membership meaningful (monthly "Carlo's edit" from *your* wardrobe + fresh catalog), and creates a new paid artifact (Wardrobe Audit).

---

## 1. UX flows

### 1.1 Wardrobe page — `/wardrobe`
New top-level page next to `/reports`, `/gallery`, `/photos` (nav: "My wardrobe").

⚠️ **Read §1.2 first — the ordering of ingestion paths changed.** Photo upload is no longer the primary
path; catalogue-sourced items are. The page below is the same, but Phase 1 renders only
catalogue-sourced cards and the upload affordance arrives in Phase 2.

- **Batch upload** (drag & drop, mobile camera): flat-lay, hanging, or worn garment photos. One garment per photo for MVP (validated, see §5).
- Each upload → recognition (§3) → **item card**: image, auto-filled title, category, color chip(s) + color-family, formality, season, "palette fit" badge (✓ in your palette / ✕ off-palette — computed against the user's colour season from their latest report profile).
- All auto-filled fields **editable** (recognition will be wrong sometimes; the user correcting it is free labeling for us).
- Filters: category, color family, palette-fit, source.
- Item actions: try on (1 cr — ⚠️ **gated, see below**), archive ("donated / worn out"), delete.

⚠️ **Try-on from a wardrobe photo will not work as originally written.** `runTryOn` takes
`garmentImageUrl` (`src/lib/ai/tryon.ts:262`) with **no notion of what the image contains**, and a
garment shot while worn, or hanging in a wardrobe under poor light, produces a bad render — you
transfer the garment *plus* another body or a distorted silhouette. Wardrobe photos are by definition
worse than catalogue shots. §5's "garments worn on a person are fine" holds for *recognition* only.

Gate it: try-on is offered for **catalogue-sourced items** (real product photography) and, for
photo-sourced items, only when the image-type classifier says the garment is presented flat/clean —
the same classifier described in the growth spec §8.3 gate 4, which is worth building once and reusing
in three places (B2C catalogue try-on, wardrobe, B2B tenants). Otherwise hide the action rather than
charging a credit for a poor render.

### 1.2 Ingestion paths — ⚠️ priority inverted

The 2026-07-15 draft made photo upload the primary path and treated the rest as extras. That is
backwards, and it is the single largest adoption risk in the plan: **nobody photographs forty garments
one at a time.** A user uploads five, sees that useful gap analysis is still far away, and does not
come back. Meanwhile a catalogue-sourced item arrives free and error-free with title, category, colour,
embedding **and a usable product photograph**.

New priority:

1. **"I own this"** on any catalogue product, on shopping-list rows of past reports, and in try-on
   history → creates a wardrobe item linked to `product_id`. No photo, **no vision call, no recognition
   error, no user edits to correct**. Try-on works because the image is real product photography.
2. **Post-purchase loop**: after a "Shop →" affiliate click, next visit shows a low-key prompt "Did you
   buy the {title}? Add it to your wardrobe" (client-side, from click history; no order tracking
   needed). This is the highest-intent moment in the product and it costs nothing to instrument —
   `affiliate_click` already exists in the events table (growth spec, A1).
3. **Photo upload** — the fallback for what the catalogue does not carry. Still necessary (most of a
   real wardrobe predates any catalogue), but it is Phase 2, not Phase 1.

**Consequence for the MVP: Phase 1 needs no AI pipeline at all.** Everything in §3 — the vision call,
the durable recognition workflow, category/colour normalisation, error handling, the edit-and-recompute
loop — moves to Phase 2. That removes most of the original Phase 1 estimate and most of its risk,
because the remaining work is CRUD plus a vector query.

### 1.3 Gap view — the money screen (`/wardrobe` → "Coverage" tab)
- **Capsule coverage matrix**: the deterministic capsule blueprint for the user's profile (already computed by `capsuleMatrix` in `src/lib/style-extras.ts`) rendered as slots; each slot shows the owned item that fills it, or "missing" with the top catalog match.
- Headline stat: "You own 7 of 12 capsule pieces → +3 pieces unlock 9 new outfits."
- **Outfit-unlock score** per suggested purchase: how many new week-of-outfits combinations it enables with owned items (§4.3).

### 1.4 Report integration (where the value shows up)
- **Shopping list**: items the user already owns (or owns a close equivalent of) get an "IN YOUR WARDROBE ✓" badge instead of a buy link; the list is re-ranked to fill *gaps* first.
- **Looks**: prompt grounding so at least one look per report is "buildable from your wardrobe + 1 new piece" (explicitly labeled).
- **New report section "Your wardrobe"** (Lookbook+): keep / tailor / retire verdicts on owned items, off-palette flags, duplicates ("you own 4 near-identical navy jumpers").
- **Start wizard**: optional step 2.5 "Add your existing wardrobe" (skippable, with a "do it later on /wardrobe" note) — do NOT make it blocking; wizard length is already at the limit.

---

## 2. Data model

New migration `00xx_wardrobe.sql`:

```sql
create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'photo',      -- photo | catalog | tryon | manual
  product_id uuid references public.products (id) on delete set null,
  photo_path text,                            -- key in 'photos' bucket (null for catalog-sourced)
  title text not null,
  category text not null,                     -- same taxonomy as products.category
  subcategory text,
  color text,                                 -- primary color name
  color_hex text,
  color_family text,                          -- same families as scripts/feeds/color.mjs
  attrs jsonb not null default '{}',          -- pattern, fabric, formality, season, fit, condition
  palette_fit text,                           -- 'in' | 'near' | 'off' (vs user colour season)
  status text not null default 'active',      -- active | archived
  embedding vector(1536),                     -- same space as products.embedding
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wardrobe_items_user_idx on public.wardrobe_items (user_id, status);
create index if not exists wardrobe_items_embedding_idx
  on public.wardrobe_items using hnsw (embedding vector_cosine_ops);
```

- RLS: owner-only select/insert/update/delete (mirror `photos` policies).
- RPC `match_wardrobe_items(user_id, query_embedding, threshold, count)` — same shape as `match_product_offers`, used for "do they already own something like this?" checks during shopping matching.
- **Same embedding model and vector space as `products`** (`openai/text-embedding-3-small`, 1536) — this is the key design decision: owned items and catalog items become directly comparable by cosine similarity, so gap analysis is a vector query, not a bespoke matcher.
- GDPR: include `wardrobe_items` in `/api/account/export` and cascade-delete already covered by `on delete cascade`; photos go to the existing `photos` bucket so the existing deletion flow covers them.

---

## 3. AI pipeline — garment recognition

New `src/lib/ai/wardrobe.ts`:

1. **`recognizeGarment(photoUrl)`** — one vision call (`modelVision`, claude-sonnet-4.5) with a Zod `Output.object` schema (same pattern as `analyzeProfile` in `src/lib/ai/pipeline.ts`):
   ```
   { isGarment: boolean, itemCount: number, title, category, subcategory,
     colors: [{name, hex}], pattern, fabricGuess, formality (1-5),
     seasons: [...], condition: 'good'|'worn'|'unclear' }
   ```
   - `isGarment=false` or `itemCount>1` → reject with a friendly message ("one piece per photo") — this doubles as the photo-quality gate.
   - Normalize `category`/`color_family` through the existing classifiers (`scripts/feeds/normalize.mjs` category regexes, `scripts/feeds/color.mjs`) — port the two pure functions into `src/lib/` so ingest scripts and the app share them (they are currently script-side only).
2. **Embedding**: build the same `embedText` string shape used for products (title + category + color + attrs) → `embed()` → store.
3. **`paletteFit(item, profile)`** — deterministic, no LLM: color_family vs the user's colour-season palette (reuse palette tables in `src/lib/style-extras.ts`).
4. Batch flow: uploads enqueue a durable workflow (`src/workflows/recognize-wardrobe.ts`, same `"use workflow"`/`"use step"` pattern as `refresh-catalog.ts`) so a 30-photo dump doesn't hit serverless timeouts; items appear on the page progressively (poll, same pattern as `ReportReadyNotifier`).

COGS note: recognition is a single small vision call (~fraction of a cent) — cheap enough to be free; **no image generation anywhere in this pipeline**, so the 72%-of-COGS image line is untouched.

---

## 4. Gap analysis & report integration

### 4.1 Owned-similar detection (shopping list)
In `matchShopping` / `matchLookItems` (`src/lib/data/catalog.ts`): after candidate selection, for each candidate query `match_wardrobe_items` with the candidate's embedding; if cosine sim ≥ ~0.80 **and** same category **and** same color family → mark `ownedSimilar: {wardrobeItemId, title}` on the `ShoppingItem`. Renderer shows the badge and drops the buy link; item moves to the bottom of its category group. Tune the threshold on your own wardrobe before shipping (see §7 validation).

### 4.2 Gap-driven re-ranking
Capsule blueprint slots (from `capsuleMatrix`) minus owned coverage = **gap slots**. `matchShopping` gets a `gapSlots` argument and boosts candidates that fill an uncovered slot. The "hero piece" pick prefers the highest-leverage *gap* item, which fixes a real current weakness (hero piece = random INVEST item).

### 4.3 Outfit-unlock score
Deterministic, reuses week-of-outfits pairing rules from `style-extras.ts`: for a candidate item, count valid combinations (by formality + color-family compatibility rules already encoded there) with owned items. Surface as "unlocks N outfits" on gap items — this is the single most persuasive purchase argument the product can make, and it's pure TypeScript, zero AI cost.

### 4.4 Report prompt grounding
`executeReportGeneration`: serialize a compact wardrobe summary (top ~40 active items: title/category/color/formality — a few hundred tokens) into the `recommend` prompt with instructions: don't recommend buying near-duplicates; build ≥1 look primarily from owned items; reference owned items by name in do/don't when relevant. Wardrobe summary is also stored in `reports.intake` snapshot so old reports stay reproducible.

### 4.5 Wardrobe Audit section (paid)
New optional section generated only when wardrobe ≥ ~8 items: LLM pass over the wardrobe summary + profile → keep / tailor / retire with reasons, duplicate clusters (via pairwise embedding sim), off-palette list. Rendered as report section between Capsule and Shopping. Translated via the existing `translateReportParts` path for non-EN reports.

---

## 5. Guardrails & edge cases

- **One garment per photo** (MVP) — enforced by `itemCount` from recognition; multi-item detection/cropping is a phase-3 nicety.
- **Person in the photo**: garments worn on a person are fine (recognition handles it), but the photo may contain a face → store in the same consent-covered `photos` bucket; wardrobe uploads do NOT require the Art. 9 biometric consent since we don't analyze the person — add a one-line clarification to Privacy instead.
- **Recognition errors**: everything editable; an edit re-computes embedding + palette_fit (cheap).
- **Abuse/cost**: ⚠️ **do not build a second limiter.** The growth spec's A0 already ships a durable
  atomic limiter (`public.rate_limits` + `rate_limit_hit` RPC) with a global daily spend cap and
  fail-closed/fail-open split. Wardrobe recognition becomes one more bucket
  (`wardrobe:user:<id>:<day>`) on that mechanism, and its runs count against the same global cap.
  Vision-only, so worst case is pennies — but the point of reusing A0 is having one place that answers
  "what did we spend today".
- ⚠️ **Image resolution and storage volume — absent from the original draft, and it becomes the largest
  storage line in the product.** Fifty items at 3–8 MB is 150–400 MB *per user*. Unlike §5.2 п. 3 of the
  growth spec — where the original selfie must be kept because it feeds try-on of the person — a
  wardrobe photo does not need the original: recognition is fine at ~1024px, and try-on of a garment
  (where permitted at all, see §1.1) at ~1280–1600px. **Downscale client-side on upload**, the way
  `ColoursExperience.tsx` already does with `MAX_EDGE`; that is roughly an order of magnitude off the
  bill. Catalogue-sourced items store no image at all — they reference `products.image_url`.
- **Cold start**: gap view requires a report (for profile/capsule). Without one, wardrobe page still works (upload, palette-neutral cards) and shows "Generate a report to see your gaps" — a new conversion surface for the wizard.
- **Stale profile**: if the user re-generates a report, palette_fit badges recompute lazily against the newest profile.

---

## 6. Monetization & credits

| Action | Cost | Rationale |
|---|---|---|
| Upload + recognition | **Free**, cap 15 items (free tier) / 50 (any paid report) / unlimited (membership) | The wardrobe is *our* asset too — maximize ingestion; caps prevent abuse and create a membership hook |
| "I own this" from catalog | Free, ⚠️ **and uncapped** | Zero COGS, pure data — the item caps above exist because *recognition* costs money. Catalogue-sourced items cost nothing, so counting them against a 15-item free-tier cap would throttle exactly the ingestion path §1.2 makes primary. Cap photo uploads, not marking what you own. |
| Try-on with own item | 1 cr (existing `tryon` price) | Same pipeline, same cost |
| Wardrobe Audit section | Included in Lookbook/Premium; **6 cr** add-on unlock on Starter/Basic (`CREDIT_COSTS.wardrobe_audit`) | Follows the existing "priced above the tier-upgrade delta" add-on pattern |
| Gap-driven shopping & owned-badges | Free in every new report | This is the differentiation itself — don't paywall the wow |
| Membership (planned €14.99/mo) | Unlimited wardrobe + monthly "Carlo's edit": 3 fresh looks from your wardrobe + new-catalog gap picks | Gives the subscription its reason to exist |

---

## 7. Phasing & estimates

⚠️ **Re-phased, and each phase now has an entry condition — the original draft had none.** Wardrobe is a
retention mechanic, and retention needs users who exist. Per the growth spec it sits outside the 90-day
plan; these conditions are what make it start.

**Phase 0 — Catalogue-only closet (days, not weeks)**
Migration + RLS/RPC; `/wardrobe` page rendering **catalogue-sourced cards only**; "I own this" on
catalogue, on past reports' shopping rows and in try-on history; palette-fit badge; `match_wardrobe_items`.
No vision pipeline (§1.2). Try-on allowed, because these are product photographs.
**Entry condition: ≥20 users own a report.** Gap analysis needs a profile and a capsule blueprint — the
"cold start" note in §5 is honest about this, so before that threshold the feature has nothing to say.
*Ship gate: on your own account, marking 10 owned items visibly changes the next report's shopping list.*

**Phase 1 — Gap engine in reports (~2 weeks)**
Owned-similar badges in shopping; gap re-ranking + hero-piece fix; coverage tab with capsule matrix +
outfit-unlock scores; wardrobe summary in report prompt; wizard step 2.5 (skippable).
**Entry condition: Phase 0 shows people actually mark what they own** — target ≥30% of report owners
marking ≥3 items within two weeks. If they don't, gap analysis has no input and photo upload will not
rescue it.

**Phase 2 — Photo ingestion (~2 weeks)**
Everything in §3: recognition workflow, normalisation, editable fields, image-type classifier for the
try-on gate, downscaling policy (§5).
**Entry condition: Phase 1 delivered measurable shopping-CTR uplift on gap-ranked rows.** Only then is
it worth paying for vision plus recognition-error UX.
*Ship gate (unchanged from the original draft): recognise 20 real garment photos with ≥80% correct
category+colour without edits.*

**Phase 3 — Retention loops (~1–2 weeks, can trail)**
Wardrobe Audit paid section; duplicate clusters; membership monthly edit (blocked on payments/membership
shipping anyway).

Dependencies: none on payments for Phases 1–2 (audit unlock in Phase 3 needs live checkout to matter). Recognition model/prompt work is the main uncertainty — timebox a 1-day spike on 30 varied photos (flat-lay / hanging / worn / bad light) before committing the schema of `attrs`.

## 8. Success metrics

⚠️ **Express these as event names in the existing `public.events` table** (growth spec, A1) — not as a
separate metrics system. Otherwise there will be two places that disagree about the same number.

| Metric | Events | Target |
|---|---|---|
| Activation | `wardrobe_item_added` per user, grouped | ≥30% of report owners with ≥3 items in 2 weeks (Phase 0 entry gate for Phase 1) |
| Ingestion mix | `wardrobe_item_added` with `props.source` = `catalog` / `tryon` / `post_purchase` / `photo` | catalogue paths should dominate; if `photo` dominates, §1.2's inversion was wrong and should be revisited |
| Retention | return visits, wardrobe users vs non | ≥2× 30-day return |
| Report uplift | conversion to 2nd report / tier upgrade | — |
| Shopping CTR | `affiliate_click` on gap-ranked rows vs baseline | measurable uplift = Phase 2 entry gate |
| Recognition quality (Phase 2 only) | `wardrobe_item_edited` / `wardrobe_item_added` | edit rate <30% |

The ingestion-mix row is the one worth watching hardest: it is the direct test of the §1.2 amendment,
and it is cheap to read.

## 9. Explicitly out of scope (for now)

- Multi-item photo splitting; wear-tracking / cost-per-wear log; weather-aware outfit-of-the-day; social closet sharing; resale/donation integrations. All plausible later; none needed to prove the loop.

*Last updated: 2026-08-03 (amended — see the ⚠️ markers; original draft 2026-07-15).*
