# Photo upload gates — design

**Date:** 2026-08-05  
**Status:** approved for planning  
**Goal:** Reject unusable photos before expensive vision / try-on work, with cheap or free checks and env kill-switches.

## Problem

Users sometimes upload photos that cannot support the feature:

- `/colours` — no face, or face not readable for colour analysis
- Shop a Look — no clothing visible
- Report wizard — wrong shot for the role (`face` / `full` / `profile`)
- Catalog try-on — no usable full-length person photo

Today those uploads still hit expensive models (Claude Sonnet vision, try-on pipeline). We need early gates that are cheap (or free) and can be disabled via env.

## Non-goals

- Identity verification or biometric matching beyond “is this photo usable for this role”
- Replacing existing A0 rate limits / anon caps
- Changing colour-analysis or Shop a Look matching quality itself
- Blocking reuse of already-accepted stored photos without re-check (optional later)

## Approach summary

| Flow | Gate | Criterion |
|---|---|---|
| `/colours` | Client-side MediaPipe face detect | Readable face present |
| Shop a Look | Server Gemini Flash-Lite | Clothing visible (on-body, flat-lay, hanger, or mannequin) |
| Report `face` | Server Flash-Lite | Readable face (preferably front-facing) |
| Report `full` | Server Flash-Lite | Full-length / body proportions usable |
| Report `profile` | Server Flash-Lite | Side / profile view |
| Catalog try-on upload | Server Flash-Lite | Full-length person (same family as report `full`) |

Server gates use a dedicated cheap model (`AI_MODEL_VISION_GATE`), not the main Sonnet vision model.

## Environment flags

All gates are independently switchable. A master switch turns everything off.

| Variable | Default (when unset) | Effect |
|---|---|---|
| `PHOTO_GATE_ENABLED` | `true` | Master switch. `false` disables all gates below. |
| `PHOTO_GATE_COLOURS_ENABLED` | `true` | Client face detect on `/colours`. |
| `PHOTO_GATE_SHOP_A_LOOK_ENABLED` | `true` | Clothing gate for Shop a Look. |
| `PHOTO_GATE_REPORT_PHOTOS_ENABLED` | `true` | Role gates for report wizard uploads. |
| `PHOTO_GATE_TRYON_ENABLED` | `true` | Full-length gate for catalog try-on upload. |
| `AI_MODEL_VISION_GATE` | `google/gemini-2.5-flash-lite` (or current cheapest Flash-Lite on AI Gateway) | Model for all server gates. |

When any gate flag is off (or master is off), that path behaves exactly as today — no check, no extra latency.

## Flow details

### 1. `/colours` — client face detect

- Run after the user selects a photo, **before** calling `/api/colours`.
- Use a free in-browser face detector (MediaPipe Face Detector or equivalent WASM library).
- Accept when at least one face is found with sufficient size / confidence (exact thresholds in implementation plan).
- On reject: show a clear message (e.g. need a brighter front-facing selfie); do not call the API.
- If the detector library fails to load or throws: **fail-open** (allow upload) so a CDN/WASM issue does not brick colours.
- Remains a UX/cost filter only; server rate limits stay authoritative.

### 2. Shop a Look — clothing gate

Valid when garments are recognisable in any of:

- person wearing clothes
- flat-lay
- hanger
- mannequin without a face

Invalid when there is no clothing to match (landscape, food, meme, face-only close-up with no garments, empty room, etc.).

Structured output (illustrative):

```ts
{
  ok: boolean;
  kind: "on_body" | "flat_lay" | "hanger" | "mannequin" | "none";
  rejectReason?: string; // short, user-safe
}
```

Run before the expensive inspiration vision + match pipeline. Cache by image hash so re-uploads of the same photo skip the gate call.

### 3. Report wizard — role gates

On file select for each role, call the gate with that role before accepting the file into the slot (and before / while upload, but never accept a failing file into the draft).

| Role | Pass when |
|---|---|
| `face` | Clear readable face |
| `full` | Full-length / body readable for proportions |
| `profile` | Side profile view |

Structured output includes `ok`, `roleMatch`, and a short `rejectReason`.

### 4. Catalog try-on upload

When the user has no suitable photo and uploads one in try-on (`TryOnButton` full-length path):

- Same criterion family as report `full`
- Gate before spending try-on credits / calling the try-on API
- Controlled by `PHOTO_GATE_TRYON_ENABLED`

## Server gate mechanics

- Single shared helper, e.g. `assertPhotoUsable({ image, purpose })` where `purpose` is `shop_a_look | report_face | report_full | report_profile | tryon_full`.
- Short prompt + tiny JSON schema; no prose essays.
- Image may be downscaled before the gate call to keep tokens low (implementation detail).
- **Cache:** key = `gateVersion + purpose + sha256(imageBytes)` (or existing photo-hash pattern), TTL ≥ 24h in the same storage/cache style used by other AI caches where practical.
- **Fail-closed** on explicit model reject (`ok: false`).
- **Fail-open** on provider/timeout/parse errors (log + allow), so outages do not block core flows.
- Cost target: roughly **$0.0001–0.0005** per gate call on Flash-Lite.

## UX

- Reject copy is specific and actionable, not generic “invalid file”.
  - Colours: face not clear → ask for brighter front selfie.
  - Shop a Look: no clothes → ask for an outfit photo, flat-lay, hanger, or mannequin.
  - Report/try-on: role mismatch → say what that slot needs.
- Do not charge credits / do not run expensive pipelines on gate reject.
- Loading: brief “Checking photo…” where the wait is noticeable (server gates).

## Security / abuse

- Client gate on `/colours` is bypassable; keep existing anon rate limits and caps.
- Server gates reduce wasted spend but are not a substitute for rate limiting.
- Gate responses must not leak model internals; only short user-safe reasons.

## Rollout

1. Ship with flags default **on** in code/docs; set explicitly in Vercel if needed.
2. If false-reject rate is high, tighten prompts/thresholds or flip the relevant flag off without redeploying product logic.
3. Metrics (best-effort via existing events): `photo_gate_reject` / `photo_gate_pass` with `purpose` and `source` — optional in first slice if events whitelist is easy; otherwise follow-up.

## Testing

- Unit tests for flag parsing (master off ⇒ all off; per-flag off).
- Unit tests for Shop a Look accept kinds (on-body / flat-lay / hanger / mannequin) vs reject.
- Unit tests for role purpose mapping (`face` / `full` / `profile` / `tryon_full`).
- Component/flow tests: colours skips API when client reject; try-on / shop / report show reject reason and do not proceed.
- Manual: one good and one bad photo per purpose before prod flag-on.

## Open implementation choices (plan, not blockers)

- Exact MediaPipe package / bundle strategy for `/colours`
- Exact Flash-Lite model id available on the current AI Gateway
- Whether report deferred-registration (IndexedDB) path gates before staging locally, or only before server upload — preference: **gate before staging** so bad photos never enter the draft
