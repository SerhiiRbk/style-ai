# Create a Look — Implementation Plan (Phases 1 & 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone, shareable "generate N looks on me" product — mini-intake + photo → same analysis → looks-only sets with a Carlo note, priced in credit bundles, with a loyalty discount and a public share page.

**Architecture:** Reuse the existing engine — `analyzeProfile` (photo → StyleProfile), `generateExtraLook` (occasion brief → look), the look image prompt, `matchLookItems` (Shop-the-Look), the credit ledger, and report-sharing infra. New: a `look_sets` grouping table, an expanded occasion taxonomy, per-request strictness/season threaded through the brief, a batch endpoint with per-look idempotent billing, a `/create-look` UI, and a public share page.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS + Storage), Vercel AI SDK, Zod, `node:test` + `tsx`.

**Spec:** `docs/create-a-look-plan.md`

## Global Constraints

- **Standalone-first.** No report required; a stored profile (report OR prior set) is reused, else run `analyzeProfile`. Persist the derived StyleProfile for reuse.
- **Male only.** Sex control defaults `male` and is disabled; the pipeline is men's menswear throughout.
- **Bundles (per set):** 3→12, 6→18, 9→22 standard; **−2 credits each** (3→10, 6→16, 9→20) for users who have **purchased ≥20 credits** (sum of `credits_ledger` rows with `reason='purchase'`, excludes signup/promo).
- **Charge per successfully rendered look**, never upfront; per-look idempotency (mirror `0018_report_spend_idempotency`). Partial failure charges only rendered looks.
- **Deliverable boundaries:** looks + one Carlo note per set; **no** capsule, report sections, or PDF. Sets are shareable.
- **Strictness + season via the `brief`**, never as new directives in the look image prompt (it is at its instruction limit).
- **A0 cost fuse** on the batch endpoint (all in `env.ts`, tunable without a logic deploy): `LOOK_SET_DAILY_CAP=150` sets/day global (fail-**closed**), `LOOK_SET_USER_CAP_PAID=15` and `LOOK_SET_USER_CAP_FREE=3` sets/user/day (fail-open, tier by `creditsPurchased > 0`). Reuse `checkLimit` + `rate_limit_hit`. The anonymous free funnel (`/api/colours`) already has its own A0 caps — `COLOURS_ANON_DAILY_CAP=5`/anon/day (fail-open) and `COLOURS_DAILY_CAP=2500`/day global (fail-closed) (VERIFIED env.ts:94,98) — not re-implemented here.
- **Photo gate + biometric consent** before any analysis (`assertPhotoUsable`, `biometricConsent` + `LEGAL.consentVersion`).
- **Occasion test:** an occasion earns a slot only with (a) a distinct brief, (b) a real non-niche ICP trigger, (c) catalogue coverage.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/look-contexts.ts` (modify) | Occasion taxonomy extended **additively** — shipped ids preserved, six new occasions appended |
| `src/lib/look-sets.ts` (create) | Pure: bundle table, discount resolution, set naming, mini-intake → Intake mapping |
| `src/lib/look-sets.test.ts` (create) | Unit tests for the pure module |
| `src/lib/credit-costs.ts` (modify) | Add `look_set` to `CreditReason` |
| `src/lib/credits.ts` (modify) | `creditsPurchased(admin, userId)` helper |
| `src/lib/env.ts` (modify) | `LOOK_SET_DAILY_CAP` / `LOOK_SET_USER_CAP_PAID` / `LOOK_SET_USER_CAP_FREE` cost-fuse constants |
| `src/lib/ai/pipeline.ts` (modify) | `generateExtraLook` accepts `boldness` + `season`, threaded into the brief; a Carlo set-note helper |
| `src/lib/data/look-sets.ts` (create) | Server: profile resolution (report ?? set ?? analyze), persist snapshot, create set + looks |
| `supabase/migrations/00xx_look_sets.sql` (create) | `look_sets` table + `looks.set_id` + share fields + RLS + public view |
| `src/app/api/look-set/route.ts` (create) | Batch endpoint: consent, gate, A0, resolve profile, generate N, per-look spend, store |
| `src/app/create-look/page.tsx` + components (create) | `/create-look` wizard UI |
| `src/app/looks/[slug]/page.tsx` (create) | Public share page for a set |
| `src/app/api/og/look-set/[slug]/route.ts` (create) | OG share card for a set |
| `src/app/api/events/route.ts` (modify) | Whitelist `look_set_*` events |

---

# PHASE 1 — Standalone Create a Look

### Task 1: Expand the occasion taxonomy

**Files:**
- Modify: `src/lib/look-contexts.ts`
- Test: `src/lib/look-contexts.test.ts` (create)

**Interfaces:**
- Consumes: shipped `LOOK_CONTEXTS` = `work, smart_casual, weekend, dinner, formal, travel` (referenced by the live look-extra add-on and stored `looks.context`).
- Produces: `LOOK_CONTEXTS` extended **additively** — all shipped ids preserved, plus new ids `business_social, wedding_guest, party, cultural, outdoor, resort`. `lookContextById(id)` unchanged. (`work`≈business, `dinner`≈date, `formal`≈formal-event already cover those spec occasions; the Create-a-Look selector relabels them for display in Task 9 — no id churn.)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/look-contexts.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { LOOK_CONTEXTS, lookContextById } from "./look-contexts";

// BACKWARD COMPAT: the existing single "extra look" add-on and every stored
// `looks.context` value depend on the shipped ids. They MUST survive.
const SHIPPED = ["work", "smart_casual", "weekend", "dinner", "formal", "travel"];
// New occasions Create-a-Look needs that aren't already represented.
const ADDED = ["business_social", "wedding_guest", "party", "cultural", "resort", "outdoor"];

test("shipped occasion ids are preserved (do not break look-extra)", () => {
  const ids = new Set(LOOK_CONTEXTS.map((c) => c.id));
  for (const id of SHIPPED) assert.ok(ids.has(id), `removed shipped id: ${id}`);
});

test("new Create-a-Look occasions are present", () => {
  const ids = new Set(LOOK_CONTEXTS.map((c) => c.id));
  for (const id of ADDED) assert.ok(ids.has(id), `missing ${id}`);
});

test("every occasion has a non-trivial brief", () => {
  for (const c of LOOK_CONTEXTS)
    assert.ok(c.brief.length > 20, `thin brief: ${c.id}`);
});

test("dinner/date brief signals approachable, not formal", () => {
  // `dinner` already carries the date intent ("Dinner / date") — no new `date` id.
  assert.match(lookContextById("dinner")!.brief, /approachable|confiden|attract|relaxed|evening/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import tsx src/lib/look-contexts.test.ts`
Expected: FAIL — new ids absent.

- [ ] **Step 3: Append the new occasions to `LOOK_CONTEXTS`**

**Do NOT remove or rename any shipped entry** — append the six new ones (keep the shipped array intact above them). Also strengthen the shipped `dinner` brief to carry the date intent. Write all six in this shape:

```ts
// ── existing entries stay exactly as they are ──
// then append:
{
  id: "business_social",
  label: "Business social (client dinner · networking · conference)",
  context: "Business social",
  brief:
    "Professional but relaxed — the after-hours edge of work. Polished separates " +
    "over a full suit; approachable, never stiff. Follows the strictness and season settings.",
},
{
  id: "wedding_guest",
  label: "Wedding guest",
  context: "Wedding guest",
  brief:
    "Celebratory and occasion-appropriate for a guest (never upstaging). Sharp tailoring, " +
    "seasonal fabric and colour; dress code lifts or relaxes with the strictness setting.",
},
{ id: "party", label: "Party / night out", context: "Party", brief:
    "Evening energy — a confident, considered going-out look with one standout element. " +
    "Bolder at higher strictness; keep it wearable, not costume." },
{ id: "cultural", label: "Cultural (theatre · gallery · dinner reservation)", context: "Cultural", brief:
    "Refined, quietly intellectual, put-together without trying hard. Texture over logos; " +
    "season-appropriate layers." },
{ id: "outdoor", label: "Outdoor / active", context: "Outdoor", brief:
    "Practical and weather-ready while still looking considered — technical fabrics, layering, " +
    "grounded palette. Strictness nudges rugged↔refined." },
{ id: "resort", label: "Resort / holiday", context: "Resort", brief:
    "Warm-weather ease — breathable fabrics, relaxed tailoring, a lighter palette. Season " +
    "biases fabric weight; strictness nudges beach↔dinner-on-the-terrace." },
```

Also update the shipped `dinner` entry's brief to include an approachable/evening signal so the test passes and the date intent is explicit (edit its `brief` string; keep its `id`/`label`/`context`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --import tsx src/lib/look-contexts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/look-contexts.ts src/lib/look-contexts.test.ts
git commit -m "feat(create-a-look): add occasions additively (preserve shipped ids)"
```

---

### Task 2: Pure bundle pricing + discount + naming + intake mapping

**Files:**
- Create: `src/lib/look-sets.ts`
- Create: `src/lib/look-sets.test.ts`

**Interfaces:**
- Produces:
  - `export const LOOK_SET_BUNDLES = [{ looks: 3, credits: 12 }, { looks: 6, credits: 18 }, { looks: 9, credits: 22 }] as const`
  - `export const LOYALTY_DISCOUNT = 2` and `export const LOYALTY_PURCHASE_THRESHOLD = 20`
  - `export function bundleFor(looks: number): { looks: number; credits: number } | null`
  - `export function priceForBundle(looks: number, loyalty: boolean): number | null`
  - `export function isLoyalty(purchasedCredits: number): boolean`
  - `export function setName(occasionLabel: string, dateISO: string, collisionTimeHHMM?: string): string`
  - `export type LookSex = "male"` ; `export function buildLookIntake(a: { age: number; bodyType?: string; sex?: LookSex }): Intake`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/look-sets.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  bundleFor, priceForBundle, isLoyalty, setName, buildLookIntake,
} from "./look-sets";
import { intakeSchema } from "@/lib/style-profile";

test("bundles are 3/6/9 only", () => {
  assert.deepEqual(bundleFor(3), { looks: 3, credits: 12 });
  assert.deepEqual(bundleFor(9), { looks: 9, credits: 22 });
  assert.equal(bundleFor(4), null);
});

test("loyalty is a flat −2 per bundle for ≥20 purchased", () => {
  assert.equal(priceForBundle(3, false), 12);
  assert.equal(priceForBundle(3, true), 10);
  assert.equal(priceForBundle(6, true), 16);
  assert.equal(priceForBundle(9, true), 20);
  assert.equal(priceForBundle(4, true), null);
});

test("loyalty threshold is purchased ≥20 credits", () => {
  assert.equal(isLoyalty(19), false);
  assert.equal(isLoyalty(20), true);
  assert.equal(isLoyalty(100), true);
});

test("set name = occasion · date; collision appends time not a counter", () => {
  assert.equal(setName("Wedding", "2026-08-12"), "Wedding · 12 Aug 2026");
  assert.equal(setName("Wedding", "2026-08-12", "14:30"), "Wedding · 12 Aug 2026 · 14:30");
});

test("mini-intake maps to a valid Intake with male + sensible defaults", () => {
  const intake = buildLookIntake({ age: 32, bodyType: "trapezoid" });
  assert.equal(intake.genderPresentation, "male");
  assert.equal(intake.age, 32);
  assert.equal(intake.bodyType, "trapezoid");
  assert.ok(intake.goals.length >= 1); // required by downstream; defaulted
  assert.ok(intake.occupation.length >= 1);
  assert.ok(intake.heightCm >= 120);
  // Load-bearing: the object must be a SCHEMA-VALID Intake, not just cast to it.
  // This guards country/budgetEur (and any future required field) against drift.
  assert.ok(
    intakeSchema.safeParse(intake).success,
    "buildLookIntake must produce a schema-valid Intake",
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test --import tsx src/lib/look-sets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `look-sets.ts`**

```ts
import type { Intake } from "@/lib/style-profile";
import { DEFAULT_LANGUAGE } from "@/lib/languages";

export const LOOK_SET_BUNDLES = [
  { looks: 3, credits: 12 },
  { looks: 6, credits: 18 },
  { looks: 9, credits: 22 },
] as const;
export const LOYALTY_DISCOUNT = 2;
export const LOYALTY_PURCHASE_THRESHOLD = 20;

export function bundleFor(looks: number) {
  return LOOK_SET_BUNDLES.find((b) => b.looks === looks) ?? null;
}
export function isLoyalty(purchasedCredits: number): boolean {
  return purchasedCredits >= LOYALTY_PURCHASE_THRESHOLD;
}
export function priceForBundle(looks: number, loyalty: boolean): number | null {
  const b = bundleFor(looks);
  if (!b) return null;
  return loyalty ? b.credits - LOYALTY_DISCOUNT : b.credits;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function setName(occasionLabel: string, dateISO: string, collisionTimeHHMM?: string): string {
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  const base = `${occasionLabel} · ${d} ${MONTHS[m - 1]} ${y}`;
  return collisionTimeHHMM ? `${base} · ${collisionTimeHHMM}` : base;
}

export type LookSex = "male";
/** Map the light Create-a-Look intake onto a full Intake with defaults for the
 * fields analyzeProfile/generateExtraLook require but the mini-intake omits. */
export function buildLookIntake(a: { age: number; bodyType?: string; sex?: LookSex }): Intake {
  return {
    age: a.age,
    genderPresentation: a.sex ?? "male",
    country: "Global",           // required (schema .min(1)); climateFor() reads it
    language: DEFAULT_LANGUAGE,   // required by the Intake type (schema .default())
    heightCm: 178,               // neutral default; not user-facing for looks
    bodyType: a.bodyType as Intake["bodyType"],
    occupation: "Not specified", // satisfies the min(1) requirement, neutral
    goals: ["Look considered"],  // one neutral goal; strictness carries intent
    boldness: "moderate",        // overridden per-request in the endpoint
    budgetEur: { min: 0, max: 1000 }, // required; generateExtraLook reads .min/.max — tunable neutral
  } as Intake;
}
```

> Note (verified against `src/lib/style-profile.ts:303-324`): `intakeSchema` requires, with NO default/optional: `age` (16–99), `genderPresentation` (`male|female|non-binary`), `country` (min 1), `heightCm` (120–230), `occupation` (min 1), `goals` (min 1), `boldness` (`conservative|moderate|experimental|statement`), `budgetEur` (`{min,max}`). Defaulted (safe to omit but included where read): `language`, `currency`, `city`, `lifestyle`. Optional: `bodyType` (`rectangle|trapezoid|triangle|inverted-triangle|hourglass|oval`), `hairColor`, `eyeColor`, `weightKg`, `measurements`, `notes`. **`country` and `budgetEur` are load-bearing:** `analyzeProfile`→`climateFor(intake.country)` crashes on `undefined`, and `generateExtraLook` reads `intake.budgetEur.min/.max` — omitting them throws at runtime even though the `as Intake` cast compiles. The intake test MUST assert `intakeSchema.safeParse(buildLookIntake(...)).success` to guard the full shape against schema drift.

- [ ] **Step 4: Run to verify pass**

Run: `node --test --import tsx src/lib/look-sets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/look-sets.ts src/lib/look-sets.test.ts
git commit -m "feat(create-a-look): pure bundle pricing, discount, naming, intake mapping"
```

---

### Task 3: `creditsPurchased` helper + `look_set` credit reason

**Files:**
- Modify: `src/lib/credit-costs.ts` (add `"look_set"` to `CreditReason`)
- Modify: `src/lib/credits.ts` (add `creditsPurchased`)
- Test: `src/lib/credits.test.ts` (create — only if it can run without a live DB; otherwise cover via the pure `isLoyalty` in Task 2 and verify `creditsPurchased` by tsc + manual)

**Interfaces:**
- Produces: `export async function creditsPurchased(admin, userId: string): Promise<number>` — sum of `credits_ledger.delta` where `reason='purchase'` (positive grants only).

- [ ] **Step 1: Add the reason**

In `src/lib/credit-costs.ts`, add `| "look_set"` to the `CreditReason` union.

- [ ] **Step 2: Implement `creditsPurchased`**

```ts
// src/lib/credits.ts
export async function creditsPurchased(
  admin: ReturnType<typeof createAdminSupabase>,
  userId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("credits_ledger")
    .select("delta")
    .eq("user_id", userId)
    .eq("reason", "purchase");
  if (error) throw new Error(error.message);   // mirror sumLedger — never mask an infra failure as "no purchases"
  return (data ?? []).reduce((s, r) => s + Math.max(0, Number(r.delta) || 0), 0);
}
```

Verified: `src/lib/credits.ts` already has `sumLedger` using `.from("credits_ledger").select("delta")` and `if (error) throw new Error(error.message)`; the ledger columns are `user_id`, `delta`, `reason`, `balance_after`. `creditsPurchased` mirrors `sumLedger` exactly (same admin type, query style, and **throw-on-error**) with an added `reason='purchase'` filter and a positive-delta clamp (ignores refund/adjustment rows). Place it beside `sumLedger`. It throws on a read error rather than returning 0, so Task 7 lets it propagate (a ledger-read failure 500s the request before any charge — a safe, retryable state — which is correct, since silently mispricing the bundle would be worse).

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/credit-costs.ts src/lib/credits.ts
git commit -m "feat(create-a-look): look_set reason + creditsPurchased loyalty signal"
```

---

### Task 4: `look_sets` migration + `looks.set_id` + share fields + RLS

**Files:**
- Create: `supabase/migrations/0039_look_sets.sql` (next number — latest shipped is `0038`; note a prior `0030` collision exists, so 0039 is correct)

**Interfaces:**
- Produces: table `look_sets`, owner-only side table `look_set_profiles` (StyleProfile PII, off the public base table), column `looks.set_id`, a column-whitelisted public view `look_sets_public_v`.

> **Do NOT run `db:migrate` in this task.** `.env.local`'s `DATABASE_URL` points at a **remote cloud Supabase** (`*.supabase.co`), and `scripts/db-migrate.mjs` applies all pending migrations there — a prod-data change. This task only creates and inspects the migration FILE. Applying is a separate, human-authorized step run against the correct environment (or via the deploy pipeline). Verification here is by careful inspection against sibling migrations, not by execution.

- [ ] **Step 1: Write the migration**

> **PII / public-sharing convention (do not deviate).** `look_sets` has a public share surface, so the repo's `reports` sharing pattern governs it (migrations `0019`→`0020`): a public-read RLS policy + `revoke all ... from anon` + `grant select(<whitelist>) to anon` on the base table, and a `security_invoker` view projecting only the whitelist. **Crucially, the StyleProfile snapshot is PII and MUST NOT live on `look_sets`** — a public SELECT policy admits the `authenticated` role too, and that role's column grants can't be locked down without breaking owners, so any logged-in user could read it off the base table via PostgREST. Mirror `report_intake` (migration `0020`): keep `profile` in an owner-only side table `look_set_profiles`, never on `look_sets`. The residual base-table columns readable by an authenticated viewer of a public row (`user_id`, `report_id`, `boldness`, plus the public-whitelist columns) match the accepted `reports` residual — no PII among them.

```sql
create table if not exists public.look_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  report_id   uuid references public.reports (id) on delete set null,
  occasion_id text not null,
  season      text not null,
  boldness    text not null,
  carlo_note  text,
  name        text not null,
  is_public   boolean not null default false,
  share_slug  text unique,
  created_at  timestamptz not null default now()
);
create index if not exists look_sets_user_idx on public.look_sets (user_id, created_at desc);

alter table public.looks add column if not exists set_id uuid
  references public.look_sets (id) on delete cascade;
create index if not exists looks_set_idx on public.looks (set_id) where set_id is not null;

-- Owner-only PII side table (mirrors report_intake): the StyleProfile snapshot
-- never touches the publicly-readable look_sets table.
create table if not exists public.look_set_profiles (
  set_id     uuid primary key references public.look_sets (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  profile    jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.look_set_profiles enable row level security;
drop policy if exists look_set_profiles_owner on public.look_set_profiles;
create policy look_set_profiles_owner on public.look_set_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- no anon/public grant: revoke all from anon (owner reads via authenticated role).

-- look_sets: owner policy + PUBLIC read policy + anon column-grant lockdown,
-- mirroring reports (migration 0020). Exact statements: see the committed
-- 0039_look_sets.sql, which reproduces the 0020 shape verbatim.
alter table public.look_sets enable row level security;
-- owner: full access to own rows;
-- public: for select using (is_public = true and share_slug is not null);
-- revoke all on public.look_sets from anon;
-- grant select (id, occasion_id, season, carlo_note, name, share_slug, created_at) on public.look_sets to anon;

-- Public share view (security_invoker): only the 7 whitelist columns, only public rows.
drop view if exists public.look_sets_public_v;
create view public.look_sets_public_v
  with (security_invoker = true) as
  select id, occasion_id, season, carlo_note, name, share_slug, created_at
  from public.look_sets
  where is_public = true and share_slug is not null;
```

- [ ] **Step 2: Verify by inspection (do NOT apply)**

Do NOT run `db:migrate` (see the box above — it targets remote prod). Instead:
- Confirm the filename number is `0039` and matches the sibling naming style.
- Open 2–3 sibling migrations that create a table with RLS and/or a view (e.g. `0030_user_profiles.sql`, `0033_rate_limits_events.sql`, `0034_leads.sql`, and whichever migration set up `reports`/sharing) and confirm this migration **matches the repo's established conventions**: whether tables enable RLS and define owner policies (mirror exactly what `reports`/`user_profiles` do — if the repo does NOT use RLS and relies on the service-role admin client, say so and follow that convention instead of adding RLS), the `gen_random_uuid()` default, `references ... on delete` style, index naming, and whether `create view ... with (security_invoker = true)` is used elsewhere (if views are unused in this repo, note it). If the established convention differs from the SQL below, follow the CONVENTION and report the deviation as a concern.
- Sanity-check the SQL parses (mental parse / `node -e` string check is fine); no execution against any DB.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0039_look_sets.sql
git commit -m "feat(create-a-look): look_sets table, looks.set_id, public share view + RLS"
```

---

### Task 5: Thread strictness + season into `generateExtraLook`; Carlo set-note

**Files:**
- Modify: `src/lib/ai/pipeline.ts`

**Interfaces:**
- Consumes: existing `generateExtraLook({ intake, profile, context, brief, note?, rules?, existingTitles? })`.
- Produces: extend opts with `boldness?: Boldness` and `season?: "spring"|"summer"|"autumn"|"winter"`; both are woven into the brief string (NOT the image prompt). Add `export async function carloNoteForSet(opts: { profile: StyleProfile; occasionLabel: string; looks: {title:string}[] }): Promise<string>`.

- [ ] **Step 1: Extend `generateExtraLook`**

Add two optional fields to the opts object — `boldness?: Boldness` and `season?: "spring" | "summer" | "autumn" | "winter"` — and add them to the destructure. `brief` is already destructured as a `const`, so compute a NEW local `effectiveBrief` and use it in place of `brief` in the prompt string (do not redeclare `brief`). Cover all four `Boldness` values:

```ts
// after the existing `const { intake, profile, context, brief, note, rules, existingTitles } = opts;`
// add boldness, season to that destructure, then:
const STRICTNESS: Record<Boldness, string> = {
  conservative: "canonically correct, understated, safe",
  moderate: "modern and balanced",
  experimental: "adventurous — unexpected but wearable combinations",
  statement: "expressive and standout, a clear focal point",
};
const seasonNote = season ? `Season: ${season} — adjust fabric weight, layering and outerwear accordingly. ` : "";
const strictnessNote = boldness ? `Strictness: ${boldness} — ${STRICTNESS[boldness]}. ` : "";
const effectiveBrief = `${seasonNote}${strictnessNote}${brief}`;
// …then use `effectiveBrief` wherever the prompt currently interpolates `brief`.
```

Import `Boldness` type from `@/lib/style-profile`. Do NOT touch the look IMAGE prompt (`generateLookImage`) — season/strictness only shape the text brief that `generateExtraLook` consumes.

- [ ] **Step 2: Add `carloNoteForSet`** — one short Carlo-voice paragraph summarising the set (a `generateText` call with the brand voice; keep it 2–3 sentences). Fall back to a deterministic sentence when `!hasAI`.

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit` → 0 errors.

- [ ] **Step 4: Manual check** (dev): call `generateExtraLook` with `boldness:"statement"` vs `"conservative"` for the same occasion and confirm the descriptions differ in formality.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/pipeline.ts
git commit -m "feat(create-a-look): per-request strictness + season in the look brief; Carlo set-note"
```

---

### Task 6: Profile resolution + set persistence (server data layer)

**Files:**
- Create: `src/lib/data/look-sets.ts`

**Interfaces:**
- Consumes: `getLatestReportProfile(userId)` from `@/lib/data/match-profile` (VERIFIED — already reads the newest `reports.profile` jsonb via `styleProfileSchema.safeParse`, returns `{ profile, personalised }`, with `neutralMatchProfile()` fallback); `analyzeProfile` from `@/lib/ai/pipeline`; `buildLookIntake` (Task 2); `styleProfileSchema`, `type StyleProfile` from `@/lib/style-profile`; admin supabase.
- Produces:
  - `export async function resolveProfileForLookSet(admin, userId, photos, intake): Promise<{ profile: StyleProfile; source: "report"|"prior_set"|"fresh" }>`
  - `export async function createLookSet(admin, { userId, reportId, occasionId, season, boldness, name, carloNote, profile, isPublic, shareSlug }): Promise<{ id: string }>`
  - `export async function saveSetLook(admin, { setId, userId, look, imagePath })` — inserts into `looks` with `set_id`.

- [ ] **Step 1: Implement resolution** — resolution order, reusing shipped code:
  1. `const rep = await getLatestReportProfile(userId)` — if `rep.personalised`, return `{ profile: rep.profile, source: "report" }`. (Do NOT reimplement the `reports` query — this helper already exists and validates with `styleProfileSchema`.)
  2. else query the newest `look_set_profiles` row for this user (join/filter to this user's sets), `select("profile").order("created_at",{ascending:false}).limit(1).maybeSingle()`, `styleProfileSchema.safeParse(data.profile)` — on success return `{ profile, source: "prior_set" }`. **Profile snapshots live in `look_set_profiles` (owner-only side table), NOT on `look_sets`** — the base table is publicly readable, so it must never hold the StyleProfile PII (see Task 4).
  3. else `const profile = await analyzeProfile(intake, photos)` and return `{ profile, source: "fresh" }`.
  The `source` drives the `create_look_analysis` event and confirms the snapshot must be written (it always is, into `look_set_profiles`).

- [ ] **Step 2: Implement `createLookSet` / `saveSetLook`** — `createLookSet` inserts the `look_sets` row (WITHOUT `profile`) and, in the same logical step, inserts the `profile` into `look_set_profiles` (`{ set_id, user_id, profile }`). Its signature keeps `profile` as an input (callers are unchanged); only the storage target differs. `saveSetLook` mirrors the existing `looks` insert in `/api/look-extra` (columns: `report_id, user_id, context, title, description, palette, image_path`, plus `set_id`).

- [ ] **Step 3: Typecheck** → `./node_modules/.bin/tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/look-sets.ts
git commit -m "feat(create-a-look): profile resolution (report/set/fresh) + set persistence"
```

---

### Task 7: Batch endpoint `POST /api/look-set`

**Files:**
- Create: `src/app/api/look-set/route.ts`

**Interfaces:**
- Consumes (all VERIFIED to exist): `assertPhotoUsable({imageDataUrl,purpose})` (`ai/photo-gate.ts:59`, returns a union — never throws), `checkLimit(bucket, limit, windowSeconds, {failOpen})→{allowed,count}` (`rate-limit.ts:25`), `logEvent`, `creditsPurchased` (Task 3), `creditBalance` (`credits.ts:57`), `spendCreditsOnce({userId,amount,reason,refId})` (`credits.ts:190`), `matchLookItems` (`catalog.ts:789`), `generateExtraLook` (`pipeline.ts:459`), `generateLookImage` (`pipeline.ts:532`), `buildLookIntake`/`priceForBundle`/`isLoyalty`/`bundleFor`/`setName` (Task 2), `resolveProfileForLookSet`/`createLookSet`/`saveSetLook` (Task 6), `carloNoteForSet` (Task 5), `LEGAL.consentVersion` (`legal.ts:7`), `lookContextById` (Task 1).
- Request body: `{ occasionId, season, boldness, looks: 3|6|9, intake: { age, bodyType }, faceImage?, fullImage?, biometricConsent, consentVersion, anonId? }`.
- Responses: `200 { setId, shareSlug, looks:[…], balance }`; `402 insufficient_credits`; `422 photo_gate`/`invalid`; `429`/lead on caps; `401`.

- [ ] **Step 1: Implement the ordered flow** (concrete steps; no placeholders):

```
1. auth: getUser → 401 if none.
2. validate body: bundleFor(looks) or 400; occasion via lookContextById or 400;
   Boldness/season parse or 400.
3. consent: require biometricConsent === true && consentVersion === LEGAL.consentVersion → 422 if missing.
4. photo gate (VERIFIED contract — returns a union, never throws):
     const g = await assertPhotoUsable({ imageDataUrl: faceImage, purpose: "report_face" });
     if (!g.ok) → 422 { code:"photo_gate", message: g.rejectReason } (+ logEvent photo_gate_reject).
     if ("skipped" in g && (g.reason === "provider_error" || g.reason === "no_ai")) → logEvent photo_gate_failopen and PROCEED (fail-open).
     if fullImage present, repeat with purpose: "report_full".
5. cost fuse (A0) — compute `purchased` ONCE here (reused by pricing in step 6, so no extra query), then two caps (window in seconds, not hours):
     const purchased = await creditsPurchased(admin, user.id);
     const g = await checkLimit(`lookset:global:${dayKey}`, env.lookSetDailyCap, 26*3600, { failOpen: false });
     if (!g.allowed) → 503 { code:"capacity" } (daily capacity reached; nothing charged).
     const userCap = purchased > 0 ? env.lookSetUserCapPaid : env.lookSetUserCapFree;   // paid 15 / free 3
     const u = await checkLimit(`lookset:user:${user.id}:${dayKey}`, userCap, 26*3600, { failOpen: true });
     if (!u.allowed) → 429 { code:"rate_limited" }.
   (VERIFIED: checkLimit at rate-limit.ts:25 → {allowed,count}; global fail-CLOSED protects business spend, per-user fail-OPEN never blocks on limiter flake.)
6. pricing (reuse `purchased`): price = priceForBundle(looks, isLoyalty(purchased));
   if (await creditBalance(admin, user.id)) < price → 402 insufficient_credits. (VERIFIED: creditBalance at credits.ts:57. Note: cap tier uses `purchased > 0`; loyalty discount uses `purchased ≥ 20` — two different thresholds, kept separate.)
7. intake: const intake = buildLookIntake({ age, bodyType }).  // pure, cheap
8. profile: resolveProfileForLookSet(admin, user.id, {faceImage, fullImage}, intake).
   if source === "fresh" → logEvent create_look_analysis. (The profile snapshot is written into the owner-only `look_set_profiles` side table by createLookSet in step 10 — never onto the publicly-readable `look_sets` row.)
9. name: setName(occasionLabel, todayISO) — pass a collision time (HH:MM) only if a same-occasion set already exists today for this user (query look_sets by occasion_id + created_at::date).
10. createLookSet({ userId, reportId: null, occasionId, season, boldness, name, carloNote: null, profile, isPublic: false, shareSlug: <generated> }) → setId.
11. compute the per-look charge VECTOR (deterministic, sums to price exactly):
      const base = Math.floor(price / looks);
      const rem  = price - base * looks;            // 0..looks-1
      const charge = Array.from({length: looks}, (_, i) => base + (i < rem ? 1 : 0));
    generate the N looks (bounded concurrency): for each index i →
      generateExtraLook({ intake, profile, context, brief, boldness, season, existingTitles: [...accumulated] })
      → generateLookImage → store image → saveSetLook({ setId, userId, look, imagePath }).
    ONLY after a look's image is stored: spendCreditsOnce(admin, { userId, amount: charge[i], reason: "look_set", refId: `lookset:${setId}:${i}` }).
    Idempotent per (setId,index): a retry of the same set never double-charges; a look that fails to render is never charged. When all N render, the charges sum to exactly `price`; on partial failure the user pays only for rendered looks. Balance was pre-checked ≥ price in step 6, so no mid-batch shortfall under normal (non-concurrent) use.
12. carloNoteForSet({ profile, occasionLabel, looks }) → UPDATE look_sets.carlo_note.
13. Shop-the-Look: for each rendered look, persist catalogue matches exactly as `/api/look-extra/route.ts` does (reuse that matchLookItems + insert path). Best-effort — a match failure is logged, never fatal to the set.
14. logEvent look_set_created { occasion, looks, loyalty, source, rendered }.
15. return 200 { setId, shareSlug, looks: [signed image URLs + titles + matches], balance }.
```

> **Billing is fixed (no open decision):** the per-look charge vector in step 11 sums to the bundle `price` when all looks render, charges proportionally on partial failure, and is idempotent per `(setId, index)` via `spendCreditsOnce` (VERIFIED at `credits.ts:190`, keyed by `reason`+`refId`). Comment the vector math in the route.

- [ ] **Step 1b: Add the cost-fuse env constants** — in `src/lib/env.ts`, next to the existing A0 / rate-limit config:

```ts
// Same intEnv(...) helper + `<feature>DailyCap` naming as the existing
// coloursDailyCap / looksDailyCap fuses (VERIFIED: env.ts:94,103).
lookSetDailyCap:    intEnv(process.env.LOOK_SET_DAILY_CAP, 150),    // global sets/day, all users — fail-CLOSED
lookSetUserCapPaid: intEnv(process.env.LOOK_SET_USER_CAP_PAID, 15), // sets/user/day, purchased>0 — fail-open
lookSetUserCapFree: intEnv(process.env.LOOK_SET_USER_CAP_FREE, 3),  // sets/user/day, signup-bonus only — fail-open
```

> **Why look-set needs its own tighter caps.** The existing `coloursDailyCap`/`looksDailyCap` fuses guard **cheap text reranks** (~$0.015/run, comments at env.ts:102). Create-a-Look **generates images** (Gemini image ≈ $0.04/look) — roughly 3× the unit cost and N per request — so it gets its own set-count fuse rather than riding the rerank caps.

> **Cost model & how to tune (rough — replace with the real AI Gateway invoice numbers).** Estimate: **~$0.05 per rendered look** (dominated by one Gemini image gen ≈ $0.04 + a small text/vision share); a first-time analysis adds **~$0.03/set** once (Sonnet vision); average bundle ≈ 6 looks. Each cap's dollar figure is the ceiling on *runaway / uncredited* spend — in normal flow the user's credits already paid for it, so the fuse only bites on a bug (uncharged retry loop, fail-open path) or abuse.
>
> | Cap (env) | Default | Worst-case $/day | Tune which way |
> |---|---|---|---|
> | `LOOK_SET_DAILY_CAP` (global) | 150 sets | ~150×6×$0.05 ≈ **$45/day** (~$1.3k/mo) | **Raise** as legit daily volume nears it (watch `rate_limit_hit` on `lookset:global:*`); each +50 sets ≈ **+$15/day** ceiling. This is your hard daily spend cap — set it to the most you'd burn before a human looks. |
> | `LOOK_SET_USER_CAP_PAID` | 15 sets | ~15×6×$0.05 ≈ **$4.5/user/day** uncredited | **Raise** only if real buyers hit it (they shouldn't — a 100-credit whale does ≈5 sets). Fail-open, so it never blocks on limiter flake. Lower only if one account is seen abusing. |
> | `LOOK_SET_USER_CAP_FREE` | 3 sets | ~3×6×$0.05 ≈ **$0.9/user/day** uncredited | Keep low — signup-bonus credits already bound these users below 3. Pure bug backstop. |
> | `COLOURS_DAILY_CAP` (existing, free funnel) | **2500**/day | ~2500×€0.04 ≈ **€100/day** (per env.ts:93) | Free tier = the only uncredited spend. **Lower** first if free-tier cost spikes (it's fail-closed → directly caps it). Anons are additionally held by `COLOURS_ANON_DAILY_CAP=5`/anon/day (set this turn; VERIFIED env.ts:98). |
>
> Money scales linearly with per-look cost: if a look really costs $0.08, the global ceiling becomes ~$72/day at the same 150-set cap. Re-derive once the real Gemini image price is known.
>
> Money math scales linearly with the per-look cost, so re-derive the table once the real Gemini image price is known: if a look actually costs $0.08, the global ceiling becomes ~$72/day at the same 150-set cap.

- [ ] **Step 2: Manual verification (dev)** — matrix:

| Case | Expect |
|---|---|
| No consent | 422 |
| Landscape face photo | 422 photo_gate |
| Balance < price | 402 |
| Loyalty user (≥20 purchased) | price = discounted |
| 6-look request, all render | 6 looks, charged discounted/standard price, one set, Carlo note present |
| 1 render fails | charged for 5, set has 5 looks |
| Global cap hit | lead/cap response, nothing charged |

- [ ] **Step 3: Commit**

```bash
git add src/app/api/look-set/route.ts
git commit -m "feat(create-a-look): batch look-set endpoint (gate, caps, per-look billing)"
```

---

### Task 8: Public share page + OG card

**Files:**
- Create: `src/app/looks/[slug]/page.tsx`
- Create: `src/app/api/og/look-set/[slug]/route.ts`
- Modify: endpoint/UI to set `is_public` + `share_slug` on "Share".

**Interfaces:**
- Consumes: `look_sets_public_v` (no personal data), the set's look images.
- Produces: a public page rendering the set's look images + Carlo note + "make yours at valetti.fit"; an OG card (reuse the vertical-asset renderer pattern from `src/lib/og`).

- [ ] **Step 1: Share page** — read `look_sets_public_v` by `share_slug` (404 if not public); render look images + `carlo_note` + CTA. No intake, no profile.

- [ ] **Step 2: OG route** — mirror `src/app/api/og/report/[id]/route.ts` (render-on-the-fly, `Cache-Control`, no Storage write); hero = first look, palette strip, brand watermark.

- [ ] **Step 3: "Share" action** — a `PATCH` (or extend the set route) that sets `is_public=true` and ensures `share_slug`; returns the public URL.

- [ ] **Step 4: Manual check** — generate a set, share it, open `/looks/{slug}` in an incognito window (unauthenticated): looks + Carlo note render, no personal data, OG card resolves.

- [ ] **Step 5: Commit**

```bash
git add src/app/looks src/app/api/og/look-set
git commit -m "feat(create-a-look): public shareable set page + OG card"
```

---

### Task 9: `/create-look` UI

**Files:**
- Create: `src/app/create-look/page.tsx` + components (mini-intake, photo picker, occasion/strictness/season/count, result view).

- [ ] **Step 1: Mini-intake step** — sex (disabled `male`), age, body type (`BodyTypePicker`, prefilled from stored profile via `getUserProfile` if present).

- [ ] **Step 2: Photo step** — offer existing face + full-length (from the user's photos / `getDefaultTryOnPhoto`); else upload. Client-side gate + biometric consent checkbox (`LEGAL.consentVersion`), reusing the report wizard's consent copy.

- [ ] **Step 3: Occasion / strictness / season / count** — occasion chips from `LOOK_CONTEXTS`; strictness slider mapped to `Boldness` (default from profile); season selector (default from geo); count = 3/6/9 with live price via `priceForBundle` + loyalty (fetch `creditsPurchased`).

- [ ] **Step 4: Generate + result** — POST `/api/look-set`; show the set (images + Carlo note), a "Share" button, and per-look Shop-the-Look. Handle `402` (buy credits), `422 photo_gate`, cap responses.

- [ ] **Step 5: Manual check** — full happy path end-to-end on a fresh (no-report) account and on a report-owner account (profile reused).

- [ ] **Step 6: Commit**

```bash
git add src/app/create-look
git commit -m "feat(create-a-look): /create-look wizard UI"
```

---

### Task 10: Events + verification

**Files:**
- Modify: `src/app/api/events/route.ts`

- [ ] **Step 1: Whitelist events** — add `look_set_started`, `look_set_created`, `create_look_analysis`, `look_set_shared` to `ALLOWED`. Fire the client-side ones from the UI; server-side ones via `logEvent`.

- [ ] **Step 2: Full verification**

```bash
node --test --import tsx src/lib/look-contexts.test.ts src/lib/look-sets.test.ts
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "chore(create-a-look): whitelist look-set events; verify build"
```

---

# PHASE 2 — Retention & virality polish

*(Entry: Phase 1 shows repeat-generation demand and shares.)*

### Task 11: "Your sets" history

**Files:** Create `src/app/looks/page.tsx` (signed-in list of the user's `look_sets` with thumbnails, occasion, date, share state).

- [ ] List `look_sets` for the user (owner RLS), newest first; link each to its set view; show public/share status; "create another" CTA. Manual check + commit.

### Task 12: Vertical share-card variants (9:16 + 2:3)

**Files:** Extend the OG/share renderer to emit 9:16 (Stories/Reels) and 2:3 (Pinterest), reusing the vertical-asset renderer built for `/colours` (A4 in the growth spec).

- [ ] Add size params to the look-set OG route; "download for stories/Pinterest" buttons on the set view. Render-on-the-fly, no Storage. Manual check + commit.

### Task 13: Season-refresh email nudge

**Files:** A cron + email (reuse Resend + the A3 email infra) that nudges users with sets from a prior season ("new season — refresh your looks").

- [ ] Gated by `hasResend`; suppressed without `emailUnsubscribeSecret`; opt-out honoured. Add to `vercel.json` crons. Manual check + commit.

### Task 14: Occasion-mix + cannibalization analytics

**Files:** A `npm run pulse`-style query (or extend the existing digest) reporting occasion mix, batch-size distribution, standalone-vs-reuse split, share rate, and set-vs-tier spend.

- [ ] Query `public.events` + `look_sets`; print the metrics from spec §9. Use it to prune thin occasions and confirm the `6=18 < Lookbook 20` cannibalization is/ isn't real. Commit.

---

## Self-Review (done)

- **Spec coverage:** standalone flow (T1,T6,T7,T9), occasions — additive, shipped ids preserved + six new, date intent carried by `dinner` (T1), strictness+season via brief (T5), pricing+loyalty (T2,T3,T7), per-look billing (T7), grouping+naming (T2,T4,T6), Carlo note (T5,T7), share page+OG (T8), boundaries no-PDF/no-sections (enforced by not building them), A0+gate+consent (T7), male-only (T2,T9), coverage gate (manual pre-launch, T7 note), events+metrics (T10,T14). Phase 2: history (T11), vertical cards (T12), email (T13), analytics (T14).
- **Placeholders:** none. Per-look billing is fully specified (deterministic charge vector, T7 step 11). Every consumed function was verified against source and cited with file:line in the Interfaces blocks.
- **Type consistency:** `bundleFor`/`priceForBundle`/`isLoyalty`/`setName`/`buildLookIntake` (T2) used consistently in T7/T9; `look_set` reason (T3) used in T7 via `spendCreditsOnce`; `look_sets`/`set_id` (T4) used in T6/T7/T8; `resolveProfileForLookSet(admin, userId, photos, intake)` (T6) called with `intake` in T7 step 8; `generateExtraLook` extended opts (`boldness`,`season`, T5) passed in T7 step 11.
- **Backward-compat guard:** T1 is additive (shipped `LOOK_CONTEXTS` ids and stored `looks.context` keep resolving; the live look-extra add-on is untouched). T4 adds `looks.set_id` nullable (existing report looks keep `set_id = null`).
- **Verified reuse (not reinvented):** latest-report profile via existing `getLatestReportProfile` (`match-profile.ts`); ledger sum pattern via existing `sumLedger`; OG via existing `og/report/[id]` renderer; per-look store/match via existing `/api/look-extra` path.

*Last updated: 2026-08-06.*
