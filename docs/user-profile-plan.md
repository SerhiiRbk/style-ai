# User Profile ("Personal Cabinet") — implementation plan (Valetti)

Feature: a persistent, editable user profile that stores the client's stable
attributes and preferences (language, country, colouring, height/weight, body
type, occupation…) plus their reusable reference photos. It seeds every new
report so the client doesn't re-enter everything each time, while each report
still keeps its own editable snapshot.

**Why (product rationale)**
- **Removes the biggest repeat-report friction.** Today intake is re-entered and
  re-derived on every report (`report_intake` is per-report) and the wizard has
  no "use my existing photo" path — so a second report is nearly as heavy as the
  first. A profile turns the 4-step wizard into "review & generate".
- **Foundation for the roadmap.** Membership (€14.99/mo) and "wardrobe as an
  asset" both need a persistent user record; the profile is that substrate.
- **Consolidates a scattered account.** Credits + deletion live on `/reports`,
  photos on `/photos`. A single `/account` (profile, photos, credits, export)
  is a real cleanup.

**Current state (verified in code)**
- No persistent profile: intake lives per-report in `report_intake`
  (migration `0020`, owner-only RLS), snapshotted at generation.
- The wizard ([src/app/start/StartForm.tsx](../src/app/start/StartForm.tsx))
  pre-fills only from geo (`initialGeo`) — never from prior answers on the
  server. Photos are uploaded to the `photos` bucket at
  `{userId}/{sessionId}/{role}.{ext}` and can only be **uploaded**, never reused.
- Reusable-photo infra exists but only for try-on: [MyPhotosManager](../src/components/MyPhotosManager.tsx),
  `photos.is_default_tryon` (migration `0027`), and the pickers in
  [src/lib/photo-tryon.ts](../src/lib/photo-tryon.ts).
- Intake shape: `intakeSchema` in [src/lib/style-profile.ts](../src/lib/style-profile.ts).

---

## 1. Field taxonomy — the core design decision

Split intake fields by how often they change **and by whether they can safely
be stored at all**, so the cabinet stays coherent:

| Class | Fields | Where it lives |
|---|---|---|
| **Derived from the photo — NEVER stored** | `undertone`, `contrast`, `faceShape`, `skinTone`, `colorSeason`, `colorSubseason` | Not columns. Re-computed by the vision step (`analyzeProfile`) on every report from that report's photo. |
| **Declared traits** (rarely change) | `hairColor`, `eyeColor`, `bodyType`, `heightCm`, `weightKg`, `measurements` | Profile core — user-entered, reused as defaults |
| **Preferences** (semi-stable) | `country`, `city`, `currency`, `language`, `occupation` | Profile defaults |
| **Situational defaults** (change every report) | `goals`, `boldness`, `budgetEur`, `lifestyle`, `notes` | Stored as *last-used hints* only. Surfaced in the UI as "for your next report", visually separate from traits — **never** silently written back |

Rule of thumb: the profile stores *who the client is and what they last asked
for*; the photo decides *how they look*; the report captures *what they want this
time*.

**Why derived appearance is never persisted.** `undertone`/`contrast`/`faceShape`/
`colorSeason` are a *reading of the photo*. If we stored them and the client later
uploads a different photo (different lighting, a tan, greyer hair), the stored
values would silently contradict the new photo — a desync that undermines the
whole "explainable" promise. So they are always re-derived per report from that
report's photo and live only in `reports.profile` (the snapshot), never in the
user profile. Only **declared** colouring (`hairColor`/`eyeColor`, when the user
explicitly sets them) is stored, and the pipeline already lets a declared value
override the vision estimate.

---

## 2. Source-of-truth model (make this explicit in code + UI)

- **Profile = editable defaults.** One row per user.
- **Each report keeps its own intake snapshot** — `report_intake` stays exactly
  as is. A report is a historical artifact: editing the profile later must
  **not** change past reports.
- **No silent write-back.** Editing values in the wizard does not update the
  profile automatically; offer an explicit "Save these as my defaults" toggle
  (default off).
- **Lazy creation.** If the user has no profile, populate it after their first
  report from the derived `StyleProfile` + `intake`. If a profile exists, the
  wizard pre-fills from it. This satisfies both requested flows — "auto-copied
  from the first report" and "filled separately" — with one code path.
- **Derived appearance is never persisted to the profile.** `undertone`,
  `contrast`, `faceShape`, `skinTone`, `colorSeason` are re-read from each
  report's photo by `analyzeProfile` and live only in that report's snapshot
  (`reports.profile`). Storing them would risk a photo↔values desync. Only
  **declared** colouring (`hairColor`/`eyeColor`, when the user sets them) is
  stored; "From photo (AUTO)" stays the default and the pipeline already lets a
  declared value override the vision estimate.
- **Age is derived from year of birth.** Store `birth_year`, not `age`, so the
  profile never goes stale as time passes; compute `age = currentYear − birth_year`
  when seeding the wizard. (The per-report snapshot still records the concrete
  `age` used for that report.)
- **Situational defaults are hints, not identity.** `goals`/`boldness`/`budgetEur`/
  `lifestyle` are stored as the *last-used* values and must be presented in the UI
  as "defaults for your next report" — a clearly separate section from traits and
  preferences, so the client never reads their goals as a permanent attribute.

---

## 3. Data model

New migration `00xx_user_profiles.sql`:

```sql
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- preferences
  country text,
  city text,
  currency text,
  language text,
  occupation text,
  -- declared traits (NO derived appearance here — see note below)
  gender_presentation text,        -- product is male-only today; store for future
  birth_year smallint,             -- store year of birth, derive age on read
  height_cm smallint,
  weight_kg smallint,
  body_type text,
  hair_color text,                 -- declared only; null ⇒ "from photo (AUTO)"
  eye_color text,                  -- declared only; null ⇒ "from photo (AUTO)"
  measurements jsonb,              -- shoulder/chest/waist/hip/sleeve (same shape as intake)
  -- situational defaults (last-used hints only; shown as "for your next report")
  goals jsonb,
  boldness text,
  budget_eur jsonb,
  lifestyle jsonb,
  -- provenance
  seeded_from_report_id uuid references public.reports (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
create policy user_profiles_rw on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- One row per user (PK = user_id). Owner-only RLS (mirrors `report_intake`).
- Nullable everywhere — a partial profile is valid; the wizard fills gaps.
- **No `undertone`/`contrast`/`faceShape`/`skinTone`/`colorSeason` columns** — by
  design (see §1/§2): those are re-derived from the photo per report and would
  desync if stored.
- `birth_year` (not `age`) so the profile never goes stale.
- `seeded_from_report_id` records the lazy-populate origin (debug/telemetry).
- No new photo table — photos already have their own table + `is_default_tryon`.

Types: add `UserProfile` to `src/lib/style-profile.ts` (a partial mirror of the
**declared** parts of `Intake`, plus `birthYear`), with:
- `intakeFromProfile(profile, { year })` → seeds wizard defaults; computes
  `age = year − birthYear`.
- `profileFromIntake(intake, { year })` → for lazy-populate; copies **declared
  traits + preferences + situational defaults only**, derives `birthYear =
  year − intake.age`. It must **not** copy any derived appearance field from the
  report's `StyleProfile`.

---

## 4. Photo reuse in the report wizard (highest-ROI slice)

Infra exists; only the wizard is missing the option.

- **Wizard step 2** ([StartForm.tsx](../src/app/start/StartForm.tsx)): add a
  "Use an existing photo" path beside "Upload new". Fetch the user's photos via
  the existing `GET /api/photos` (returns roles + full-length list + default);
  let the user pick a `face` + `full` set (or the pinned `is_default_tryon`
  default) instead of uploading. When reused, pass the existing storage paths in
  the report submit instead of freshly-uploaded ones.
- **Consistency with identity fix.** Reusing a stable default face+full set makes
  look renders and try-ons use the same reference across reports — reinforcing
  the identity-anchor work already done.
- **Registration.** Reused photos already have `photos` rows; new uploads
  register as today. The report links whichever set was chosen.

This slice alone removes most repeat-report friction and needs no profile table —
ship it first.

---

## 5. Integration points

1. **Read**: `getUserProfile(userId)` in `src/lib/data/user-profile.ts` (admin/owner
   read). Wizard server component passes it into `StartForm` as `initialProfile`
   (alongside the existing `initialGeo`); `initialProfile` wins over geo.
2. **Pre-fill**: `StartForm` initial state seeds from `initialProfile`
   (falling back to `initialGeo`, then defaults). No behavioural change when the
   profile is absent (first-timers keep today's fast path).
3. **Write (explicit)**: `PUT /api/account/profile` — validate against a
   `userProfileSchema`, upsert the row. Backs the `/account` edit form and the
   optional "save as defaults" toggle in the wizard.
4. **Lazy populate**: in `executeReportGeneration` (or right after first successful
   report in the reports data layer), if the user has no `user_profiles` row,
   insert one via `profileFromIntake(intake, { year })` — i.e. **declared intake
   fields + preferences + last-used situational hints only**, with
   `birth_year = year − intake.age`. Do **not** copy derived appearance from the
   report's `StyleProfile`. Stamp `seeded_from_report_id`. Guarded so it only runs
   when no profile exists — never overwrites an edited profile.
5. **Report generation unchanged**: still snapshots `intake` into `report_intake`.
   The profile only *seeds* the wizard; the report is authoritative for itself.

---

## 6. Account page — `/account`

New route consolidating the scattered account surfaces. The profile form is split
into **two visually distinct groups** so the client never mistakes a styling
preference for a permanent trait:

- **"About you"** (traits + preferences — who you are): year of birth (age shown
  computed, read-only), country/city, currency, language, occupation, height/
  weight, body type, declared colouring (hair/eye, with "From photo (AUTO)" as an
  option). These read as durable facts.
- **"Defaults for your next report"** (clearly separated card, muted styling +
  a one-line caption like *"Starting points for your next report — you can change
  them each time"*): goals, boldness, budget, lifestyle. Framed as hints, not
  identity.
- *(Optional, read-only)* a small "How your last photo read" note surfacing the
  derived `colorSeason`/`undertone` from the latest report — clearly labelled as
  *read from your photo*, never editable, to reinforce that appearance comes from
  the image, not a stored setting.
- **Photos**: embed the existing `MyPhotosManager` (upload/manage, pick default
  try-on model).
- **Credits + purchases**: move the balance/credits UI here from `/reports`.
- **Data & privacy**: GDPR export + account deletion (currently on `/reports`).

Keep `/reports` focused on the report library; link to `/account` from the nav.

---

## 7. Privacy / GDPR

- `user_profiles` holds appearance data (measurements, colouring) — user-entered,
  lower sensitivity than biometric photos, but must be covered:
  - **Export**: add `user_profiles` to
    [src/lib/data/account-export.ts](../src/lib/data/account-export.ts)
    (already exports `report_intake`).
  - **Delete**: `on delete cascade` on `user_id` covers account deletion; verify
    the deletion flow triggers it.
- Photos remain consent-gated as today (Art. 9 biometric consent on upload).
  Reusing an existing photo for a new report is covered by the original consent;
  the wizard's consent checkbox stays for new uploads.

---

## 8. Phasing

**Phase 1 — Photo reuse + defaults seed (~1 week)**
Wizard "use existing photo" path (infra exists) + persist last intake as
editable defaults (either the new `user_profiles` table or seed from the latest
`report_intake`). Biggest friction removed for the least work.

**Phase 2 — Profile as first-class + `/account` (~1–1.5 weeks)**
`user_profiles` migration + read/write API + lazy populate from first report +
`/account` view/edit page + wizard pre-fill from profile + "save as defaults"
toggle + export/delete coverage.

**Phase 3 — Tie-ins (trails)**
Feed the profile into membership (monthly edit uses stored profile) and
"wardrobe as an asset" (the profile is the record those features attach to).

Dependencies: none on payments for Phases 1–2. Phase 1 can ship before the
`user_profiles` table by seeding defaults from the latest report_intake, then be
backed by the table in Phase 2.

---

## 9. Risks & guardrails

- **Don't make the profile mandatory** — keep the fast wizard path for
  first-timers (profile absent ⇒ today's behaviour).
- **No silent write-back** — editing a report's intake must not mutate the
  profile without the explicit toggle; and editing the profile must not alter
  past reports (they're snapshots).
- **Stale data** — height/city change over time; everything editable; reports
  stay pinned to their snapshot. Age is never stored — `birth_year` is, so it
  can't drift.
- **Never store derived appearance** — `undertone`/`contrast`/`faceShape`/
  `colorSeason` are re-read from the photo each report; storing them would let a
  new photo contradict old stored values.
- **Gender** stays locked to male (current product scope); the column exists for
  future use only.
- **UI clarity** — state plainly: "Your profile = defaults for new reports; each
  report is a snapshot you can tweak." Prevents "why didn't my old report change".

## 10. Success metrics

- Repeat-report conversion (2nd report started / 1st completed) — expect a
  meaningful lift from the review-and-generate flow.
- Wizard completion time / drop-off on step 1 (intake) and step 2 (photos).
- % of reports generated with a reused photo vs new upload.
- % of users with a populated profile after their first report (lazy-populate
  coverage).

## 11. Out of scope (for now)

- Multiple named profiles per account (e.g. styling for someone else).
- Editing situational fields (goals/budget) as "hard" profile values — they stay
  per-report hints.
- Social/shared profiles; profile-based public pages.

*Last updated: 2026-07-17.*
