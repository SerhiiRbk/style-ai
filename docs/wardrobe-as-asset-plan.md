# Wardrobe as an Asset — implementation plan (Valetti)

Feature: the user photographs (or imports) the clothes they already own → Valetti builds a structured, embedded "owned wardrobe" → every report, shopping list and look becomes **gap-driven** ("you already own this; buy these 3 pieces and unlock 6 new outfits") instead of a generic buy-list.

**Why this feature (product rationale)**
- Retention: turns a one-shot report into a living profile the user returns to. No competitor has it: Stitch Fix doesn't know your closet, ChatGPT doesn't persist it, Zalando only knows its own catalog.
- Trust: "don't buy what you already own" is the strongest possible proof of the "method, not opinion" brand promise.
- Moat: wardrobe data compounds — switching cost grows with every item uploaded.
- Monetization: makes the planned €14.99/mo membership meaningful (monthly "Carlo's edit" from *your* wardrobe + fresh catalog), and creates a new paid artifact (Wardrobe Audit).

---

## 1. UX flows

### 1.1 Wardrobe page — `/wardrobe`
New top-level page next to `/reports`, `/gallery`, `/photos` (nav: "My wardrobe").

- **Batch upload** (drag & drop, mobile camera): flat-lay, hanging, or worn garment photos. One garment per photo for MVP (validated, see §5).
- Each upload → recognition (§3) → **item card**: image, auto-filled title, category, color chip(s) + color-family, formality, season, "palette fit" badge (✓ in your palette / ✕ off-palette — computed against the user's colour season from their latest report profile).
- All auto-filled fields **editable** (recognition will be wrong sometimes; the user correcting it is free labeling for us).
- Filters: category, color family, palette-fit, source.
- Item actions: try on (1 cr, reuses existing try-on pipeline with the garment photo as reference), archive ("donated / worn out"), delete.

### 1.2 Ingestion paths (beyond upload)
1. **Photo upload** — primary path (above).
2. **"I own this"** on any catalog / shopping-list product → creates a wardrobe item linked to `product_id` (no photo needed; we already have image, category, color, embedding).
3. **Post-purchase loop**: after a "Shop →" affiliate click, next visit shows a low-key prompt "Did you buy the {title}? Add it to your wardrobe" (client-side, based on click history in localStorage; no order tracking needed for MVP).
4. **From try-on history**: items the user tried on and liked → one-tap "add to wardrobe".

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
- **Abuse/cost**: recognition free but rate-limited (e.g. 60 items/day) and capped per tier (see §6); vision-only, so worst case is pennies.
- **Cold start**: gap view requires a report (for profile/capsule). Without one, wardrobe page still works (upload, palette-neutral cards) and shows "Generate a report to see your gaps" — a new conversion surface for the wizard.
- **Stale profile**: if the user re-generates a report, palette_fit badges recompute lazily against the newest profile.

---

## 6. Monetization & credits

| Action | Cost | Rationale |
|---|---|---|
| Upload + recognition | **Free**, cap 15 items (free tier) / 50 (any paid report) / unlimited (membership) | The wardrobe is *our* asset too — maximize ingestion; caps prevent abuse and create a membership hook |
| "I own this" from catalog | Free | Zero COGS, pure data |
| Try-on with own item | 1 cr (existing `tryon` price) | Same pipeline, same cost |
| Wardrobe Audit section | Included in Lookbook/Premium; **6 cr** add-on unlock on Starter/Basic (`CREDIT_COSTS.wardrobe_audit`) | Follows the existing "priced above the tier-upgrade delta" add-on pattern |
| Gap-driven shopping & owned-badges | Free in every new report | This is the differentiation itself — don't paywall the wow |
| Membership (planned €14.99/mo) | Unlimited wardrobe + monthly "Carlo's edit": 3 fresh looks from your wardrobe + new-catalog gap picks | Gives the subscription its reason to exist |

---

## 7. Phasing & estimates

**Phase 1 — Closet MVP (~2 weeks)**
Migration + RLS/RPC; `/wardrobe` page (upload, cards, edit, archive); recognition workflow; "I own this" on catalog/shopping; palette-fit badge. *Ship gate: recognize 20 real garment photos from your own wardrobe with ≥80% correct category+color without edits.*

**Phase 2 — Gap engine in reports (~2 weeks)**
`match_wardrobe_items` + owned-similar badges in shopping; gap re-ranking + hero-piece fix; coverage tab with capsule matrix + outfit-unlock scores; wizard step 2.5 (skippable); wardrobe summary in report prompt.

**Phase 3 — Retention loops (~1–2 weeks, can trail)**
Wardrobe Audit paid section; try-on from wardrobe items; post-purchase "did you buy it?" loop; duplicate clusters; membership monthly edit (blocked on payments/membership shipping anyway).

Dependencies: none on payments for Phases 1–2 (audit unlock in Phase 3 needs live checkout to matter). Recognition model/prompt work is the main uncertainty — timebox a 1-day spike on 30 varied photos (flat-lay / hanging / worn / bad light) before committing the schema of `attrs`.

## 8. Success metrics

- Activation: % of report-owning users with ≥5 wardrobe items (target 25% by week 4).
- Retention: 30-day return rate, wardrobe users vs non (expect ≥2×).
- Report uplift: conversion to 2nd report / tier upgrade for wardrobe users.
- Shopping CTR on gap-ranked items vs old ranking.
- Edit rate on recognized fields (proxy for recognition quality; target <30%).

## 9. Explicitly out of scope (for now)

- Multi-item photo splitting; wear-tracking / cost-per-wear log; weather-aware outfit-of-the-day; social closet sharing; resale/donation integrations. All plausible later; none needed to prove the loop.

*Last updated: 2026-07-15.*
