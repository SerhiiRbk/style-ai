# Free colour analysis + sharing — implementation plan (Valetti)

Feature: a **free, no-signup** mini colour analysis from one selfie — "Your colours" — that returns the user's colour season + a palette + 2–3 lines from Carlo, then paywalls the full report. Doubles as the top-of-funnel spearhead and the source of shareable artifacts.

**Why this feature (product rationale)**
- **Fixes the funnel.** Today the first step is a paid report — a high barrier for cold traffic. A free taste lets strangers experience the "wow" before paying, and captures an email for remarketing. See `docs/growth-plan.md` §2.
- **Rides a live trend.** Colour analysis is peaking virally, almost entirely female. "Men's colours from one selfie" is timely and under-contested.
- **Feeds the #1 channel.** The palette card is a native short-video / social artifact ("this is my season"), so acquisition and content reinforce each other.
- **Cheap.** One vision call (no image generation, no full report pipeline) → low marginal cost per free run.

---

## 1. UX flow

### 1.1 Landing → capture → result
New public page **`/colours`** (SEO target: "men's colour analysis", "what colours suit me man"):
1. Hero: "Discover your colours — free. One selfie, 20 seconds." + upload/camera.
2. Upload one face photo (client-side downscale before upload; never store without consent — see §5).
3. Loading state (reuse the report's Carlo-voiced loading copy).
4. **Result** — free, no login required:
   - Colour **season + subseason** (e.g. "Deep Autumn") with one-line rationale.
   - **Palette**: 6–8 swatches (the season palette, same source the report uses).
   - **Undertone + contrast** one-liner.
   - **2–3 lines from Carlo** — what this means in plain terms + one concrete "so wear / avoid" cue.
   - **Share** button (§4) and **email capture** ("email me my palette").
   - **Upsell** CTA → full report (wardrobe, shopping "why", try-on): the money step.

### 1.2 Deliberate limits (free vs paid)
Free gives the *diagnosis*; paid gives the *prescription*. Free shows season + palette + a taste of Carlo. It does **not** include: the shopping list, looks, try-on, body-type/tailoring guidance, or the PDF. Those are the paid report. Keep the line crisp so free stays cheap and paid stays worth it.

### 1.3 Rate & abuse control
Anonymous, so cap by IP + a lightweight client token (e.g. 1–2 free runs per IP/day) to bound compute. Over the cap → "create an account to continue" (still free tier, but gated).

---

## 2. Reuse — what already exists

Do NOT build a new analysis engine. Reuse:
- **`analyzeProfile(intake, photos)`** — `src/lib/ai/pipeline.ts:91`. Already returns `undertone`, `contrast`, `colorSeason`, `colorSubseason` from a photo via `env.modelVision`. For the free run, call a **trimmed variant** (see §3) that only needs the colour fields, with a minimal `intake` (age/gender optional; the vision call works without them).
- **`classifySubseason(...)`** — `src/lib/style-profile.ts` — maps season + undertone + contrast + colouring → subseason label.
- **Season → palette** — the palette arrays already live in `src/lib/report.ts` (see `palette:` per season, e.g. lines ~384–414). Extract the season→palette map into a shared `paletteForSeason(season, subseason)` helper so both the report and `/colours` use one source of truth.
- **Share cards** — `getReportShareCard` / `getLookShareCard` + `src/lib/og/report-share-card.tsx` and the `/api/og` route already render branded OG images. Add a palette-card variant (§4).
- **Credits / signup bonus** — `src/lib/credits.ts` (`ensureSignupBonus`, `grantCredits`) for the upsell hand-off.

---

## 3. New / changed code

### 3.1 Trimmed analysis
Add `analyzeColoursOnly(photoUrl)` in `src/lib/ai/pipeline.ts` (or a small `src/lib/ai/colour-analysis.ts`):
- Same `visionSchema` but only the colour-relevant fields (`skinTone`, `undertone`, `contrast`, `colorSeason`, `hairColor`, `eyeColor`), no body-type inference, no report content.
- Returns `{ season, subseason, undertone, contrast, palette, carloNote }`.
- `carloNote` — a short, safe blurb. Prefer a **deterministic template** keyed by season/undertone/contrast (like the existing report `report.ts` rationale copy) over a second AI call, to keep it free-tier cheap and on-voice. One AI call total per free run.

### 3.2 API route
`src/app/api/colours/route.ts` (POST):
- Accepts an uploaded image (multipart or a short-lived signed upload), enforces size/type.
- Rate-limit by IP + token (§1.3).
- Runs `analyzeColoursOnly`, returns JSON for the result screen.
- Does **not** persist the photo unless the user opts in (§5). If email captured, store `{ email, season, subseason, palette }` for lifecycle email (§6) — no photo.

### 3.3 Page + components
- `src/app/colours/page.tsx` — public, SEO metadata, `dynamic` as needed.
- `ColoursUploader` (client) — reuse the wizard's photo capture; downscale client-side.
- `ColourResult` (client) — palette swatches (reuse `ColourSwatchPicker` visual language), Carlo note, share + email + upsell CTAs.
- Prefill hand-off: on "unlock full report", carry season/undertone into `/start` so the wizard is pre-seeded and the user doesn't re-analyze (they still upload for the full pipeline, but the colour step is confirmed, not repeated).

---

## 4. Sharing (the growth loop)

- **Palette share card** — add a `getPaletteShareCard(season, palette)` variant next to `getReportShareCard` in `src/lib/og/report-share-card-data.ts`, rendered by a new template in `report-share-card.tsx`, served via the existing `/api/og` route. Card shows: season name, the palette swatches, a face-cropped thumbnail (only if the user consented to keep the photo), and "Your colours · valetti.fit".
- **Share button** — Web Share API on mobile, copy-link + download-image fallback on desktop. The shared image *is* the ad.
- **Branding** — subtle wordmark + domain on every artifact (palette card, and existing PDF/try-on). This is the cheapest paid-media substitute we have.

---

## 5. Privacy (must-get-right)

- The free photo is **processed, not stored by default**. Analyze in-request, discard.
- Only persist the photo if the user explicitly ticks "save my photo / show it on my share card".
- No login means no RLS owner — so the anonymous path must never write a photo to a durable bucket without consent. Email (if given) is stored without the photo.
- Reflect this in the on-page copy ("we analyze your photo and don't keep it") and the privacy policy.

---

## 6. Email lifecycle (capture → convert)

- On email capture: send "your palette" email (embeds the palette card) + soft CTA to the full report.
- Abandoned free analysis (email, no purchase) → 1–2 nudges: "unlock your full look / shopping edit".
- Keep it light; the palette card carries the value, the copy just points to the paywall.

---

## 7. Metrics to wire

Tie into the funnel from `docs/growth-plan.md` §6:
- `/colours` visit → analysis completed (ToFu conversion).
- analysis → email captured.
- analysis → signup → paid report (activation + monetization).
- share button clicks / share-card impressions (loop health).

---

## 8. Build order (phased)

**Phase 1 — the taste (highest leverage).**
1. Extract `paletteForSeason` shared helper from `report.ts`.
2. `analyzeColoursOnly` + deterministic `carloNote` templates.
3. `/api/colours` route with IP/token rate limit, no-store photo default.
4. `/colours` page + uploader + result screen + upsell hand-off to `/start`.

**Phase 2 — the loop.**
5. `getPaletteShareCard` + OG template + share button.
6. Branding pass on PDF/try-on/palette artifacts.

**Phase 3 — capture & convert.**
7. Email capture + lifecycle emails.
8. Analytics wiring for all funnel steps.

**Phase 4 — polish.**
9. SEO content around `/colours` (see growth-plan §3B).
10. Rate-limit tuning + abuse review once real traffic lands.

---

## 9. Risks / watch-outs
- **Free abuse / compute cost** — bound with rate limits; one AI call per run; deterministic Carlo note.
- **Free cannibalizing paid** — keep the free/paid line crisp (§1.2): diagnosis free, prescription paid.
- **Privacy misstep** — never store the anonymous photo without explicit consent (§5).
- **Palette drift** — one `paletteForSeason` source of truth so `/colours` and the report never disagree.
- **Accuracy expectations** — colour season from one selfie varies with lighting; set expectations in copy ("best in natural light") and let the full report re-confirm.
