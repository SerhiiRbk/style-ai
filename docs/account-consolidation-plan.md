# `/account` consolidation — phased execution plan (Valetti)

Consolidate the scattered account surfaces into a single `/account` hub, in
**independently shippable phases** that can be picked up one at a time. Pairs
with [user-profile-plan.md](./user-profile-plan.md) (the profile data model +
wizard integration) — this doc is the ordered execution roadmap that stitches
everything together.

**Why**
- Account state is spread across pages today: credit balance + GDPR export +
  account deletion live on [/reports](../src/app/reports/page.tsx); reference
  photos on [/photos](../src/app/photos/page.tsx); generated images on
  [/gallery](../src/app/gallery/page.tsx). There is no profile at all and no
  `/account` route. A single hub is clearer for users and the natural home for
  the coming profile, membership and wardrobe features.

**Current surfaces (verified in code)**
- Nav ([NavSession.tsx](../src/components/NavSession.tsx)): "My reports", "My
  looks", credits pill → `/pricing`, "Admin" (admins). No Account link.
- `/reports`: report list + balance display + link to `/gallery` + "Manage my
  photos →" (`/photos`) + `ExportDataButton` + `DeleteAccountButton`.
- `/photos`: `MyPhotosManager` (upload/manage reference photos, pick default
  try-on model).
- Components already exist and just need re-homing: `ExportDataButton`,
  `DeleteAccountButton`, `BuyCreditsButton`, `CreditsContext`, `MyPhotosManager`.

**Design principles**
- **Additive, never big-bang.** Each phase adds a section to `/account` and
  leaves the old location working (or replaces it with a thin redirect) so
  nothing breaks mid-migration and bookmarks survive.
- **No dead ends.** Old links (`/photos`, the "Manage my photos" link) become
  redirects to `/account` once their section lands.
- **Backend-free until the profile.** Phases 1–3 move existing UI only — no DB
  changes. The DB work starts at Phase 4 (profile), gated by the profile plan.

---

## The ordered backlog (pick up one at a time)

Each item lists: goal · scope · key files · depends-on · ships-independently.

### Phase 1 — `/account` shell + Data & Privacy
- **Goal:** a real `/account` route and the first consolidated section.
- **Scope:** create `src/app/account/page.tsx` (Navbar/Footer shell, a simple
  sectioned layout — anchored sections, not tabs, so it streams and deep-links).
  Move `ExportDataButton` + `DeleteAccountButton` into an "Data & privacy"
  section. Add an "Account" link to `NavSession`. On `/reports`, replace the
  export/delete block with a one-line link to `/account`.
- **Files:** `src/app/account/page.tsx` (new), `NavSession.tsx`,
  `src/app/reports/page.tsx`.
- **Depends on:** nothing.
- **Ships independently:** yes — a reachable hub with working export/delete.

### Phase 2 — Photos section
- **Goal:** reference-photo management lives in the hub.
- **Scope:** embed `MyPhotosManager` as an `/account` "Photos" section. Turn
  `/photos` into a thin redirect to `/account#photos` (keep the route for
  bookmarks). Point the `/reports` "Manage my photos →" link at `/account#photos`.
- **Files:** `src/app/account/page.tsx`, `src/app/photos/page.tsx` (→ redirect),
  `src/app/reports/page.tsx`.
- **Depends on:** Phase 1.
- **Ships independently:** yes.

### Phase 3 — Credits & purchases section
- **Goal:** balance, top-up, and purchase history in one place.
- **Scope:** an `/account` "Credits" section showing the balance, `BuyCreditsButton`
  (still "Checkout coming soon" until `PAYMENTS_ENABLED`), and — when available —
  purchase history from the credits ledger. Keep the nav credits pill; point it
  at `/account#credits` (instead of `/pricing`) for signed-in users. Trim the
  balance block on `/reports` to a compact link.
- **Files:** `src/app/account/page.tsx`, `NavSession.tsx`, a small
  `getCreditPurchases()` read if history is included.
- **Depends on:** Phase 1.
- **Ships independently:** yes.

### Phase 4 — Profile section (data + read/edit)
- **Goal:** the personal cabinet — view/edit traits, preferences, and
  next-report defaults.
- **Scope:** implement the `user_profiles` table, read/write API and mappers per
  [user-profile-plan.md §3–§6](./user-profile-plan.md), then render the profile
  form on `/account` in the two visually-separated groups ("About you" vs
  "Defaults for your next report"), plus the optional read-only "how your last
  photo read" note. Lazy-populate from the first report.
- **Files:** `supabase/migrations/00xx_user_profiles.sql`, `src/lib/style-profile.ts`
  (types + mappers), `src/lib/data/user-profile.ts` (new), `src/app/api/account/profile/route.ts`
  (new), `src/app/account/page.tsx`, `src/lib/data/reports.ts` (lazy populate),
  `src/lib/data/account-export.ts` (export coverage).
- **Depends on:** Phase 1; the profile plan.
- **Ships independently:** yes (profile works even before wizard integration).

### Phase 5 — Wizard integration (defaults + photo reuse)
- **Goal:** close the loop — new reports start from the profile and can reuse
  photos.
- **Scope:** pass `initialProfile` into `StartForm` (same mechanism as the
  existing `initialGeo`) so step 1 pre-fills; add the "use an existing photo"
  path to step 2 (infra: `GET /api/photos`, `is_default_tryon`); add the optional
  "save these as my defaults" toggle. Per
  [user-profile-plan.md §4–§5](./user-profile-plan.md).
- **Files:** `src/app/start/StartForm.tsx`, `src/app/start/page.tsx` (pass
  profile), `src/app/api/reports/route.ts` (accept reused photo paths).
- **Depends on:** Phase 4 (defaults) — but the **photo-reuse** slice can ship
  before Phase 4 independently, since it needs no profile (it's the cheapest,
  highest-ROI slice; see profile plan Phase 1).
- **Ships independently:** photo-reuse yes; defaults pre-fill after Phase 4.

### Phase 6 — Future hooks (not now)
- Membership section on `/account` (once payments + membership ship).
- Wardrobe section (per [wardrobe-as-asset-plan.md](./wardrobe-as-asset-plan.md)).

---

## Suggested order & why

1. **Phase 1** (shell + data/privacy) — establishes the hub, zero backend, low risk.
2. **Phase 5 photo-reuse slice** — cheapest, highest-ROI UX win; needs no profile.
3. **Phase 2** (photos section) — natural pairing with photo-reuse; UI move only.
4. **Phase 3** (credits) — UI move; can slot in any time after Phase 1.
5. **Phase 4** (profile) — the one DB-backed phase; unlocks the cabinet.
6. **Phase 5 defaults pre-fill** — after Phase 4.
7. **Phase 6** — as membership/wardrobe land.

This ordering front-loads the visible wins (hub + photo reuse) and defers the
only migration (Phase 4) until the UI shell is proven.

## Cross-cutting guardrails
- **Redirects, not deletions.** `/photos` stays as a redirect; never 404 a
  previously-shared/bookmarked account URL.
- **One nav entry.** Add a single "Account" link; don't multiply nav items
  (keep "My reports" and "My looks" as the content entries).
- **Auth + RLS unchanged.** Every `/account` read is owner-scoped exactly as the
  current pages are; no new exposure.
- **Deep-linkable sections.** Use anchored sections (`/account#photos`,
  `#credits`) so existing links can target them and the page streams top-down.
- **Don't regress `/reports`.** It stays the report library; it only loses the
  account chrome (with a link left behind).

## Success metrics
- Fewer clicks to reach photos/export/profile (hub vs scattered).
- Account-page engagement (profile completion, photo management) after each phase.
- No increase in 404s / broken-link reports post-migration (redirects working).

*Last updated: 2026-07-17.*
