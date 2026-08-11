# Create a Look — implementation plan (Valetti)

Feature: a **standalone, shareable "generate looks on me" product**. The user
picks an occasion, a strictness level, a season and a count, and receives that
many photorealistic looks **on themselves**, each with a short Carlo note,
grouped into a shareable set. **No report required** — if the user has never
generated a report, we run the same photo analysis and produce looks-only (no
capsule, no report sections, no PDF). Credits per bundle.

**Positioning.** This sits deliberately between the free colour palette
(`/colours`) and the full report: more personal and visual than a palette,
lighter than a report. It is looks-only and **shareable** — a native social
artifact that feeds acquisition (see `docs/growth-plan.md` §4, artifact loop),
not just retention.

**What's reused (this is ~70% existing engine):**
- `analyzeProfile` (`src/lib/ai/pipeline.ts`) — vision → full `StyleProfile`
  (palette, physical, season/undertone/contrast/clarity) from photos. This is
  how a no-report user gets a profile.
- `generateExtraLook` — standalone single-look generator (occasion `brief` +
  profile + `existingTitles` de-dup).
- `LOOK_CONTEXTS`, `Boldness`, the look image prompt, `matchLookItems`
  (Shop-the-Look), `looks` table, `spendCredits` ledger, report-sharing infra
  (0008/0019 + OG cards), `BodyTypePicker`, `getDefaultTryOnPhoto`.

New build = occasion expansion + mini-intake + standalone analysis path +
per-request strictness/season + batch + set grouping/naming + a share page + UI.

---

## 1. Flow (standalone-first)

```
/create-look
  → mini-intake (sex, age, body type)  +  photos (pick existing or upload)
  → [if no stored profile] analyzeProfile(photo)  → StyleProfile (persisted)
     [if stored profile]    reuse it (report owner or prior Create-a-Look user)
  → pick occasion + strictness + season + count
  → generate N looks (generateExtraLook × N, look image each) + a Carlo note
  → grouped into a named, shareable set
```

**Profile source is no longer a gate** (the previous owner-only framing is
dropped). Standalone is the primary path; a stored profile (from a report OR a
prior look set) is simply reused, skipping re-analysis. Persist the profile so
repeat sets don't re-analyse and so it can seed a future report
(ties to `docs/user-profile-plan.md`).

### 1.1 Mini-intake (lighter than the report wizard)

| Field | Rule |
|---|---|
| **Sex** | Default **male**; combobox **disabled** (female not supported yet — keep the control visible so the roadmap is discoverable, but locked). |
| **Age** | Required — `analyzeProfile` uses it. |
| **Body type** | Prefill from the stored profile if present; always overridable via `BodyTypePicker`. User value is **authoritative** for the look's fit/silhouette (photo drives colouring, self-report drives body — same precedence the report uses for colouring). |
| **Photos** | Offer the user's existing **face** and **full-length** photos (from `photos` / `getDefaultTryOnPhoto`); if absent, allow upload. **Face is required** (colour analysis + identity); **full-length strongly recommended** (accurate head-to-shoes render). Photo gate + biometric consent (§5) apply before any analysis. |

Hair/eye colour are NOT asked — `analyzeProfile` infers them from the photo
(self-report would take precedence if ever added).

---

## 2. Occasions — expand, don't over-split

An occasion earns its own slot only if it has (a) a **distinct styling brief** —
not merely a strictness/season/aesthetic variation of an existing one, (b) a
**real, non-niche purchase trigger** for the ICP, and (c) **catalogue coverage**.
Apply this test to every future addition — it is what stops the taxonomy
degrading into many near-identical buttons.

Fold the business cluster (interview / meeting / presentation / consultation /
office / public speaking / lecture) into one `business` occasion whose intensity
is set by the strictness slider — they share one brief and differ only by
strictness. Proposed ~10 genuinely distinct occasions:

`business` · `business_social` (lunch/client dinner) · `date` · `wedding_guest` ·
`party` · `smart_casual` · `cultural` · `resort` (coverage-gated) ·
`outdoor` (smart-casual, **not** technical hiking) · `travel`.

- **`date`** — a headline ICP trigger (`docs/growth-plan.md` §1). Distinct intent:
  approachable and confident, not formal. Spans day-date ↔ evening-date via the
  strictness slider + season, so one occasion covers the range.
- **`business` on-stage/on-camera nuance** — when the context is public speaking /
  lecture / presentation, the brief adds "matte solid colours, no fine repeating
  patterns that moiré on camera". A brief note inside `business`, **not** a
  separate occasion.

Real hiking / technical outdoor excluded — the catalogue is quiet-luxury
tailored/smart menswear, not gear. `resort`/`outdoor` ship only if catalogue
coverage holds (§5, launch gate). Implement by extending `LOOK_CONTEXTS`.

**Declined occasions (recorded so they aren't re-proposed):**

| Proposed | Why not |
|---|---|
| Public speaking / lecture | Same brief as `business` at high strictness — fails test (a). Served by the on-stage nuance above. |
| Old money / cigar or wine club | An **aesthetic** (heritage / quiet-luxury), not an event; overlaps `cultural`/`business_social` and maps to the strictness/heritage lean. Niche. Fails (a). |
| Blogging | Not a well-defined occasion (a content-creation context, no clear brief); skews creative-young, off the quiet-luxury brand. Fails (a) and (b). |

---

## 3. Strictness + season (both via the brief, not the image prompt)

- **Strictness = per-request `Boldness` override** (`conservative | moderate |
  experimental | statement`), defaulting to the profile's boldness. It is NOT a
  new axis and it does NOT mutate the stored profile. Thread it into the
  generation `brief`.
- **Season** (`spring|summer|autumn|winter`, default from geo) shapes fabric
  weight, layering and whether outerwear appears — also via the `brief`. The
  "outerwear worn slightly open to show the layer underneath" nuance (nice for
  `outdoor`/`resort`) is a brief-level styling note.

Both go through the **brief**, never as new hard directives in the look image
prompt — that prompt is already at its instruction-attention limit (see the
growth-design prompt-length discussion).

---

## 4. Deliverable & boundaries (what makes it NOT a report)

- **Looks + one Carlo note per set.** No capsule, no week-of-outfits matrix, no
  report sections, no shopping "why" depth beyond Shop-the-Look links.
- **No PDF export.** Explicit product boundary vs the report.
- **Shareable set.** A public set page (mirror report sharing: 0008/0019 +
  column-whitelisted view, no personal intake exposed) + an OG card + "make
  yours at valetti.fit". This is the acquisition/virality hook.
- Shop-the-Look per look is kept (reuses `matchLookItems` / `look_items`) — it's
  the affiliate branch and costs nothing extra to include.

These boundaries are the differentiator that keeps Create-a-Look from
cannibalizing the report: looks-only & shareable vs method + capsule + PDF.

---

## 5. Economics (final)

Bundles (per set, one occasion+season+strictness selection):

| Looks | Standard | Loyalty (bought ≥20 credits) | Std cr/look |
|---|---|---|---|
| 3 | **12** | **10** | 4.00 |
| 6 | **18** | **16** | 3.00 |
| 9 | **22** | **20** | 2.44 |

- **Loyalty discount = flat −2 credits per bundle**, for users who have
  **purchased ≥20 credits** (cumulative `credits_ledger` rows with
  `reason = "purchase"` — excludes signup bonus and promo grants). Computable
  from the existing ledger; NOT tied to owning a Premium report (spend, not tier).
- **Single look (1–2) stays on the existing `look_extra` add-on (5 cr)** for
  report owners; Create-a-Look bundles start at 3. (Standalone users wanting 1
  look would take the 3-bundle; acceptable.)
- **COGS-safe with room.** A standalone set = 1 analysis vision call (~€0.02,
  absorbed) + N image gens (the real cost, ~€0.04–0.10 each). At ≥2.44 cr/look
  (~€2.44) margin is ample; persisting the profile means repeat sets skip the
  analysis entirely.

**Cannibalization check (standalone is now live, so it matters):**

| Looks | Std price | Nearest tier | Verdict |
|---|---|---|---|
| 3 | 12 | Basic 10 (3 looks + report) | tier cheaper → safe |
| 6 | 18 | Lookbook 20 (6 looks + capsule + matrix + try-on + hair + plan) | 2 cr under tier but tier gives far more → acceptable |
| 9 | 22 | Lookbook 20 / Premium 35 | 22 > Lookbook 20; << Premium → safe |

Standard prices sit **at or above** the equivalent-look tier for new buyers, so
the acquisition path doesn't undercut the report. The loyalty price (10/16/20)
dips to parity, but only for proven payers who are past the first-purchase
decision — acceptable. The earlier exact `9 = 20 = Lookbook` collision is gone
(standard 9 = 22).

---

## 6. Grouping & naming

N looks in one request = a **set**. Data model:

```sql
create table if not exists public.look_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  report_id   uuid references public.reports (id) on delete set null, -- null for standalone
  occasion_id text not null,
  season      text not null,
  boldness    text not null,               -- resolved per-request strictness
  carlo_note  text,                         -- one note for the set
  name        text not null,               -- see below
  is_public   boolean not null default false,
  share_slug  text unique,                  -- for the public share page
  created_at  timestamptz not null default now()
);

alter table public.looks add column if not exists set_id uuid
  references public.look_sets (id) on delete cascade;
create index if not exists looks_set_idx on public.looks (set_id) where set_id is not null;
```

Report looks keep `set_id = null`; Create-a-Look looks carry `set_id`. RLS
owner-only for private sets; the public share page reads a column-whitelisted
view (no intake, no user_id), same hardening as `reports_public_v` (0019/0020).
GDPR: cascade-delete + include `look_sets` in `/api/account/export`.

**Naming:** `{Occasion label} · {DD Mon YYYY}`; a second set of the same occasion
on the same day gets a **time** suffix (`… · 14:30`), never a `#N` counter
(counters need a lookup, look worse, collide under concurrency).

---

## 7. Guardrails & launch gates

- **A0 cost fuse.** A standalone set spends a vision analysis + N image gens on a
  low-friction, signup-gated surface. Reuse the A0 pattern: global daily cap +
  per-user/day cap; charge credits **per successfully rendered look** (not
  upfront) with a per-look idempotency key (mirror `0018_report_spend_idempotency`).
  Partial failure (3 of 6) → charge 3, offer free retry of the failures.
- **Photo gate + consent.** Photo gate (usability) before analysis; biometric
  consent (`biometricConsent` + `LEGAL.consentVersion`, as the report wizard)
  collected before the photo leaves the client / is analysed.
- **Catalogue coverage per occasion × season** — the launch gate. Hide occasions
  with thin inventory (`resort`, `outdoor`) rather than shipping weak looks.
- **Male-only** enforced by the disabled sex control; the pipeline is men's
  menswear throughout, so this is consistent, not a stopgap hack.
- **Prompt length** — all new signals via the brief; image prompt untouched.
- **Distinctness** — pass the set's own titles as `existingTitles`.
- **Strictness override scope** — affects this set only; never writes the profile.

---

## 8. Phasing

**Phase 1 — standalone Create a Look (~1.5–2 weeks).**
Mini-intake + photo pick/upload + consent; standalone `analyzeProfile` path with
profile persistence; expanded `LOOK_CONTEXTS`; `boldness`/`season` via brief;
batch endpoint + per-look idempotent spend + loyalty pricing; `look_sets` +
`looks.set_id`; Carlo note; shareable set page + OG; `/create-look` UI.
*Entry: catalogue coverage passes (§7); A0 fuse in place.*

**Phase 2 — retention & virality polish.**
"Your sets" history; season-refresh email nudge; share-card variants (9:16 / 2:3)
reusing the vertical-asset renderer; occasion-mix pruning from data.

---

## 9. Success metrics (events in `public.events`)

- Sets created; batch-size distribution; standalone vs profile-reuse split.
- **Share rate of a set** and inbound from shared set pages (the virality signal).
- Standalone set → later report conversion (does the light product feed the deep one?).
- Occasion mix (prunes the taxonomy); render success rate per occasion (coverage).
- Loyalty-vs-standard purchase split; credit spend attributable to look sets.

---

## 10. Open decisions / notes

- **`6 = 18` sits 2 credits under Lookbook (20).** Accepted (Lookbook gives far
  more for +2); revisit if data shows looks-only buyers skipping Lookbook.
- **Analysis reuse across sets** relies on profile persistence; confirm the
  persisted profile is refreshed if the user uploads a materially different photo
  later (else stale colouring).
- **Standalone requires signup** (credits + set ownership). The anonymous entry
  stays the free `/colours` palette; Create-a-Look is the first paid step.

## 11. Explicitly out of scope

- Female styling (disabled control; roadmap).
- PDF export, capsule, report sections (the boundary that defines this product).
- Real technical hiking/outdoor gear.
- Editing individual looks in a set (regen exists via `look_regen`).

*Last updated: 2026-08-06.*
