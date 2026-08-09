# Photo Upload Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject unusable photos before expensive vision/try-on work — free MediaPipe face detect on `/colours`, cheap Gemini Flash-Lite gates for Shop a Look (clothing), report roles, and catalog try-on — all kill-switchable via env.

**What each gate is (and is not).** The server Flash-Lite gates (Shop a Look, report, try-on) run *before* the expensive Sonnet/try-on call, so they genuinely cut cost on those paths. The `/colours` gate is **folded into the colours vision call itself** — a `usable` flag on the analysis schema (see the 2026-08-05 revision note below), so an unusable photo is rejected from the same call with no second model and zero client weight. It improves the wow-moment (no palette from a landscape) but does **not** save the colours vision spend; that spend is held by A0 (durable limiter + daily cap), not by this gate. Do not conflate the two.

> **2026-08-05 revision.** Task 7 originally used a client-side MediaPipe face detector. Rejected during implementation: MediaPipe pulls ~12 MB of wasm to the browser on the first photo pick — a multi-second stall and 12 MB of egress at the exact mobile-cold-traffic wow-moment, to save one already-cheap, A0-capped vision call. Replaced with a `usable: boolean` field folded into the existing `analyzeColoursOnly` vision call (`src/lib/ai/colour-analysis.ts`): same call, no extra model, no client bytes, proper reject copy. Task 7 below is superseded by this note.

**Architecture:** Shared flag helpers + a server `assertPhotoUsable` AI gate (Flash-Lite) exposed through `POST /api/photo-gate` for client upload flows and called in-process from `/api/shop-a-look`. `/colours` keeps a client-only MediaPipe check before `POST /api/colours`. Explicit model rejects fail-closed; provider/timeout errors fail-open **and emit a `photo_gate_failopen` event** so a dead gate is visible, not silent.

**Tech Stack:** Next.js App Router, Vercel AI SDK (`ai` + AI Gateway), Zod, MediaPipe Tasks Vision (`@mediapipe/tasks-vision`), existing Supabase Storage cache pattern, `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-08-05-photo-upload-gates-design.md`

## Global Constraints

- Server gates MUST use `AI_MODEL_VISION_GATE`, never `AI_MODEL_VISION` (Sonnet). **First implementation step of Task 2: confirm the gateway actually answers with this model id** — a wrong id fails silently into fail-open (see next bullet), so verify before building on it.
- Default all gate flags **on** when unset; only `"false"` / `"0"` / `"no"` turns a flag off. **But default-on means live in prod the moment this ships** — including the MediaPipe download on the colours wow-moment path. Ship with master `PHOTO_GATE_ENABLED=false`, enable on preview, watch the `photo_gate_failopen` rate (below), then flip prod on. Canary, not big-bang.
- Master `PHOTO_GATE_ENABLED=false` disables every gate.
- **Fail-open must be observable.** Every provider/timeout/parse fail-open and every MediaPipe load failure emits `photo_gate_failopen { purpose }`. Rejects emit `photo_gate_reject`, passes `photo_gate_pass`. These events are **not optional** (contrast Task 8's original framing): a gate pointed at a bad model id fails open 100% of the time, rejects nothing, spends on vision anyway, and is invisible without this. Same rule as "no silent caps".
- Client colours gate needs `NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED` (and respects `NEXT_PUBLIC_PHOTO_GATE_ENABLED` if set).
- Explicit `ok: false` from the model → reject. Provider/timeout/parse errors → **fail-open** (allow + log).
- MediaPipe load/runtime failure on `/colours` → **fail-open**.
- Shop a Look accepts clothing on-body, flat-lay, hanger, or mannequin — not face-required.
- Catalog try-on upload uses purpose `tryon_full` (full-length person).
- Gate before staging report draft photos (IndexedDB) and before try-on Storage upload.
- Do not charge credits / do not run expensive pipelines on gate reject.
- ~~Self-host the MediaPipe wasm + `.tflite` model~~ **Superseded (2026-08-05):** no MediaPipe. The `/colours` gate is a `usable` flag on the colours vision call — no wasm, no model, no CDN. See the revision note at the top.
- YAGNI: no biometric identity matching; no gate-result Storage cache (Flash-Lite is fractions of a cent and the photo-hash already short-circuits at the shop-a-look match cache — a gate cache buys little and adds a third orphan-blob source per spec §3.2).

## File map

| File | Responsibility |
|---|---|
| `src/lib/photo-gate-flags.ts` | Pure flag parsing (testable, no I/O) |
| `src/lib/photo-gate-types.ts` | **Pure, NOT `server-only`**: `PhotoGatePurpose`, `purposeToFlagKey`, `userMessageForReject`. Imported by both the server gate and the client helper — decided once, up front, so nothing gets moved mid-plan. |
| `src/lib/env.ts` | Wire gate model + server flag accessors |
| `src/lib/ai/photo-gate.ts` | `server-only` Flash-Lite `assertPhotoUsable` (no cache — see constraints) |
| `src/lib/ai/photo-gate.test.ts` | Unit tests for purposes/schema helpers |
| `src/lib/photo-gate-flags.test.ts` | Flag matrix tests |
| `src/app/api/photo-gate/route.ts` | `POST` for client flows (report / try-on) |
| `src/lib/client/photo-gate.ts` | Browser helper: dataURL → `/api/photo-gate` |
| `src/lib/client/face-detect.ts` | MediaPipe wrapper for `/colours` |
| `src/components/ColoursExperience.tsx` | Call face detect before `/api/colours` |
| `src/components/ShopALookExperience.tsx` | Surface `photo_gate` reject copy |
| `src/app/api/shop-a-look/route.ts` | In-process clothing gate before inspiration vision |
| `src/app/start/StartForm.tsx` | Gate before `stagePhoto` / `uploadPhoto` |
| `src/components/TryOnButton.tsx` | Gate before Storage upload |
| `.env.local` / Vercel env docs note in plan commit message | Set model + flags |

---

### Task 1: Flag helpers + env wiring

**Files:**
- Create: `src/lib/photo-gate-flags.ts`
- Create: `src/lib/photo-gate-flags.test.ts`
- Modify: `src/lib/env.ts`

**Interfaces:**
- Produces:
  - `flagDefaultTrue(raw: string | undefined): boolean`
  - `resolvePhotoGateFlags(envLike): PhotoGateFlags`
  - `type PhotoGateFlags = { master: boolean; colours: boolean; shopALook: boolean; reportPhotos: boolean; tryon: boolean }`
  - `isPhotoGateActive(flags, key): boolean` — false if master off or key off
  - `env.modelVisionGate: string`
  - `env.photoGate*: boolean` accessors for server

- [ ] **Step 1: Write the failing flag tests**

```ts
// src/lib/photo-gate-flags.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  flagDefaultTrue,
  resolvePhotoGateFlags,
  isPhotoGateActive,
} from "./photo-gate-flags";

test("flagDefaultTrue is true when unset", () => {
  assert.equal(flagDefaultTrue(undefined), true);
  assert.equal(flagDefaultTrue(""), true);
});

test("flagDefaultTrue respects falsey tokens", () => {
  assert.equal(flagDefaultTrue("false"), false);
  assert.equal(flagDefaultTrue("0"), false);
  assert.equal(flagDefaultTrue("no"), false);
  assert.equal(flagDefaultTrue("true"), true);
});

test("master off disables every gate", () => {
  const f = resolvePhotoGateFlags({
    PHOTO_GATE_ENABLED: "false",
    PHOTO_GATE_SHOP_A_LOOK_ENABLED: "true",
    PHOTO_GATE_REPORT_PHOTOS_ENABLED: "true",
    PHOTO_GATE_TRYON_ENABLED: "true",
    NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED: "true",
  });
  assert.equal(isPhotoGateActive(f, "shopALook"), false);
  assert.equal(isPhotoGateActive(f, "reportPhotos"), false);
  assert.equal(isPhotoGateActive(f, "tryon"), false);
  assert.equal(isPhotoGateActive(f, "colours"), false);
});

test("per-flag off leaves others on", () => {
  const f = resolvePhotoGateFlags({
    PHOTO_GATE_SHOP_A_LOOK_ENABLED: "false",
  });
  assert.equal(isPhotoGateActive(f, "shopALook"), false);
  assert.equal(isPhotoGateActive(f, "reportPhotos"), true);
  assert.equal(isPhotoGateActive(f, "colours"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import tsx src/lib/photo-gate-flags.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement flags + env**

```ts
// src/lib/photo-gate-flags.ts
export function flagDefaultTrue(raw: string | undefined): boolean {
  if (raw == null || raw === "") return true;
  const v = raw.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

export type PhotoGateFlags = {
  master: boolean;
  colours: boolean;
  shopALook: boolean;
  reportPhotos: boolean;
  tryon: boolean;
};

export type PhotoGateKey = keyof Omit<PhotoGateFlags, "master">;

export function resolvePhotoGateFlags(
  envLike: Record<string, string | undefined>,
): PhotoGateFlags {
  // Client colours: prefer NEXT_PUBLIC_*; fall back to server-named twin.
  const coloursRaw =
    envLike.NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED ??
    envLike.PHOTO_GATE_COLOURS_ENABLED;
  const masterRaw =
    envLike.PHOTO_GATE_ENABLED ?? envLike.NEXT_PUBLIC_PHOTO_GATE_ENABLED;
  return {
    master: flagDefaultTrue(masterRaw),
    colours: flagDefaultTrue(coloursRaw),
    shopALook: flagDefaultTrue(envLike.PHOTO_GATE_SHOP_A_LOOK_ENABLED),
    reportPhotos: flagDefaultTrue(envLike.PHOTO_GATE_REPORT_PHOTOS_ENABLED),
    tryon: flagDefaultTrue(envLike.PHOTO_GATE_TRYON_ENABLED),
  };
}

export function isPhotoGateActive(
  flags: PhotoGateFlags,
  key: PhotoGateKey,
): boolean {
  return flags.master && flags[key];
}
```

In `src/lib/env.ts` add:

```ts
modelVisionGate:
  process.env.AI_MODEL_VISION_GATE ?? "google/gemini-2.5-flash-lite",
// Convenience snapshots for server routes (resolved once at boot):
photoGate: resolvePhotoGateFlags(process.env as Record<string, string | undefined>),
```

Import `resolvePhotoGateFlags` from `./photo-gate-flags`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --import tsx src/lib/photo-gate-flags.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/photo-gate-flags.ts src/lib/photo-gate-flags.test.ts src/lib/env.ts
git commit -m "$(cat <<'EOF'
feat(photo-gate): add env kill-switches and Flash-Lite model slot

EOF
)"
```

---

### Task 2: Pure gate types/helpers + server `assertPhotoUsable` (Flash-Lite)

**Files:**
- Create: `src/lib/photo-gate-types.ts` (pure — type + `purposeToFlagKey` + `userMessageForReject`)
- Create: `src/lib/photo-gate-types.test.ts` (tests the pure helpers)
- Create: `src/lib/ai/photo-gate.ts` (`server-only` — `assertPhotoUsable` only)
- Create: `src/lib/ai/photo-gate.test.ts`

> **Module layout decided here, once.** The pure type + helpers live in `photo-gate-types.ts` with **no** `server-only`, so the client helper (Task 3) can import them without pulling a server module into the browser bundle. `photo-gate.ts` holds only the server function. This avoids the mid-plan refactor the earlier draft did in Task 3.

**Interfaces:**
- `photo-gate-types.ts` (pure) produces:
  - `export type PhotoGatePurpose = "shop_a_look" | "report_face" | "report_full" | "report_profile" | "tryon_full"`
  - `export function purposeToFlagKey(purpose): PhotoGateKey`
  - `export function userMessageForReject(purpose, modelReason): string`
- `photo-gate.ts` (`server-only`) consumes `env.modelVisionGate`, `env.photoGate`, `hasAI`, and produces:
  - `export type PhotoGateResult = { ok: true; kind?: string } | { ok: false; rejectReason: string; code: "rejected" } | { ok: true; skipped: true; reason: "flag_off" | "no_ai" | "provider_error" }`
  - `export async function assertPhotoUsable(args: { imageDataUrl: string; purpose: PhotoGatePurpose }): Promise<PhotoGateResult>`
  - `export function purposeEnabled(purpose: PhotoGatePurpose): boolean`

- [ ] **Step 0: Confirm the gate model answers.** Before any code: a one-off call through the gateway with `AI_MODEL_VISION_GATE` on a sample image. A wrong id fails silently into fail-open — verify it works before building on it.

- [ ] **Step 1: Write failing unit tests for the pure helpers**

```ts
// src/lib/photo-gate-types.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  purposeToFlagKey,
  userMessageForReject,
  type PhotoGatePurpose,
} from "./photo-gate-types";

test("purpose maps to flag keys", () => {
  assert.equal(purposeToFlagKey("shop_a_look"), "shopALook");
  assert.equal(purposeToFlagKey("report_face"), "reportPhotos");
  assert.equal(purposeToFlagKey("report_full"), "reportPhotos");
  assert.equal(purposeToFlagKey("report_profile"), "reportPhotos");
  assert.equal(purposeToFlagKey("tryon_full"), "tryon");
});

test("reject messages are purpose-specific", () => {
  const shop = userMessageForReject("shop_a_look", "no clothes");
  assert.match(shop, /outfit|flat-lay|hanger|mannequin/i);
  const face = userMessageForReject("report_face", "blurry");
  assert.match(face, /face|portrait|selfie/i);
  const full = userMessageForReject("tryon_full", "crop");
  assert.match(full, /full-length|head-to-toe/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import tsx src/lib/photo-gate-types.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3a: Implement the pure module `photo-gate-types.ts`** (no `server-only`)

```ts
// src/lib/photo-gate-types.ts
import type { PhotoGateKey } from "@/lib/photo-gate-flags";

export type PhotoGatePurpose =
  | "shop_a_look"
  | "report_face"
  | "report_full"
  | "report_profile"
  | "tryon_full";

export function purposeToFlagKey(purpose: PhotoGatePurpose): PhotoGateKey {
  switch (purpose) {
    case "shop_a_look":
      return "shopALook";
    case "tryon_full":
      return "tryon";
    default:
      return "reportPhotos";
  }
}

export function userMessageForReject(
  purpose: PhotoGatePurpose,
  _modelReason: string,
): string {
  switch (purpose) {
    case "shop_a_look":
      return "We couldn't find clothing to match. Try a full-outfit photo, flat-lay, hanger, or mannequin shot.";
    case "report_face":
      return "We need a clear front-facing face photo for this slot.";
    case "report_profile":
      return "We need a side-profile photo for this slot.";
    case "report_full":
    case "tryon_full":
      return "We need a clear full-length (head-to-toe) photo for this slot.";
  }
}
```

- [ ] **Step 3b: Implement the server module `photo-gate.ts`** (`server-only`, no cache)

```ts
import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import { isPhotoGateActive } from "@/lib/photo-gate-flags";
import {
  purposeToFlagKey,
  userMessageForReject,
  type PhotoGatePurpose,
} from "@/lib/photo-gate-types";
// NOTE: createAdminSupabase, if ever needed, is exported from "@/lib/supabase/server"
// (there is no "@/lib/supabase/admin"). Not needed here — the gate holds no cache.

export function purposeEnabled(purpose: PhotoGatePurpose): boolean {
  return isPhotoGateActive(env.photoGate, purposeToFlagKey(purpose));
}

const shopSchema = z.object({
  ok: z.boolean(),
  kind: z.enum(["on_body", "flat_lay", "hanger", "mannequin", "none"]),
  rejectReason: z.string().optional(),
});

const roleSchema = z.object({
  ok: z.boolean(),
  rejectReason: z.string().optional(),
});

export type PhotoGateResult =
  | { ok: true; kind?: string }
  | { ok: true; skipped: true; reason: "flag_off" | "no_ai" | "provider_error" }
  | { ok: false; rejectReason: string; code: "rejected" };

export async function assertPhotoUsable(args: {
  imageDataUrl: string;
  purpose: PhotoGatePurpose;
}): Promise<PhotoGateResult> {
  if (!purposeEnabled(args.purpose)) {
    return { ok: true, skipped: true, reason: "flag_off" };
  }
  if (!hasAI) {
    return { ok: true, skipped: true, reason: "no_ai" };
  }

  try {
    // generateText with env.modelVisionGate + purpose-specific schema/prompt
    // shop_a_look: clothing visible? kinds above — log `kind` to the event (Task 8)
    // report_* / tryon_full: role match via roleSchema
    // On ok:false → { ok:false, rejectReason: userMessageForReject(...), code:"rejected" }
    // On ok:true  → { ok:true, kind? }
  } catch (err) {
    console.error("[photo-gate] provider error", args.purpose, err);
    // The CALLER emits photo_gate_failopen — see Task 8. Do not swallow silently.
    return { ok: true, skipped: true, reason: "provider_error" };
  }
}
```

Two deliberate deletions from the earlier draft: **no `PHOTO_GATE_CACHE_VERSION` / Storage cache** (constraints — Flash-Lite is too cheap to justify a third orphan-blob source), and **no `createAdminSupabase` import** (it would have been the wrong path anyway; the gate needs no admin client).

Prompts (keep terse):

- `shop_a_look`: “Does this image show wearable clothing to shop (on a person, flat-lay, hanger, or mannequin)? Face optional. Set kind=none if no garments.”
- `report_face`: “Is there a clear, readable human face suitable for colour/style analysis (preferably front-facing)?”
- `report_full` / `tryon_full`: “Is this a full-length (head-to-toe) photo of a person usable for fit/proportions/try-on?”
- `report_profile`: “Is this a side-profile photo of a person’s head/shoulders?”

- [ ] **Step 4: Run unit tests**

Run: `node --test --import tsx src/lib/photo-gate-types.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/photo-gate-types.ts src/lib/photo-gate-types.test.ts src/lib/ai/photo-gate.ts src/lib/ai/photo-gate.test.ts
git commit -m "$(cat <<'EOF'
feat(photo-gate): add pure gate types/helpers and Flash-Lite assertPhotoUsable

EOF
)"
```

---

### Task 3: `POST /api/photo-gate` + browser client helper

**Files:**
- Create: `src/app/api/photo-gate/route.ts`
- Create: `src/lib/client/photo-gate.ts`

**Interfaces:**
- Consumes: `assertPhotoUsable`, `PhotoGatePurpose`
- Produces:
  - `POST` body `{ image: string /* data URL */, purpose: PhotoGatePurpose }`
  - `200` `{ ok: true }` or `{ ok: true, skipped: true }`
  - `422` `{ ok: false, code: "rejected", error: string }`
  - `checkPhotoGateClient({ fileOrDataUrl, purpose }): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Implement API route**

```ts
// src/app/api/photo-gate/route.ts
import { NextResponse } from "next/server";
import { assertPhotoUsable } from "@/lib/ai/photo-gate";
import type { PhotoGatePurpose } from "@/lib/photo-gate-types";

const PURPOSES = new Set<PhotoGatePurpose>([
  "shop_a_look",
  "report_face",
  "report_full",
  "report_profile",
  "tryon_full",
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const image = typeof body?.image === "string" ? body.image : "";
  const purpose = body?.purpose as PhotoGatePurpose;
  if (!image.startsWith("data:") || !PURPOSES.has(purpose)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (image.length > 6_000_000) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }
  const result = await assertPhotoUsable({ imageDataUrl: image, purpose });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.rejectReason },
      { status: 422 },
    );
  }
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Implement browser helper**

```ts
// src/lib/client/photo-gate.ts
import type { PhotoGatePurpose } from "@/lib/photo-gate-types";

async function fileToDataUrl(file: File): Promise<string> {
  // Reuse the same createImageBitmap downscale pattern as ColoursExperience
  // (max edge ~1280) so gate payloads stay small.
}

export async function checkPhotoGateClient(args: {
  imageDataUrl?: string;
  file?: File;
  purpose: PhotoGatePurpose;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const image =
    args.imageDataUrl ??
    (args.file ? await fileToDataUrl(args.file) : "");
  if (!image) return { ok: false, error: "Missing image" };
  try {
    const res = await fetch("/api/photo-gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, purpose: args.purpose }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 422) {
      return {
        ok: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "This photo doesn't work for this step.",
      };
    }
    // 5xx / network → fail-open (server already fail-opens provider errors;
    // if the route itself is down, don't block the user).
    if (!res.ok) return { ok: true };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
```

Note: this is why `PhotoGatePurpose` already lives in `src/lib/photo-gate-types.ts` (Task 2), not in the `server-only` `photo-gate.ts` — importing the type from a server module here would pull server code into the client bundle. Nothing to move; the layout was decided up front.

- [ ] **Step 3: Smoke-typecheck**

Run: `./node_modules/.bin/tsc --noEmit`  
Expected: no errors about server-only in client imports

- [ ] **Step 4: Commit**

```bash
git add src/app/api/photo-gate/route.ts src/lib/client/photo-gate.ts
git commit -m "$(cat <<'EOF'
feat(photo-gate): add API route and browser client helper

EOF
)"
```

---

### Task 4: Shop a Look clothing gate (in-process)

**Files:**
- Modify: `src/app/api/shop-a-look/route.ts`
- Modify: `src/components/ShopALookExperience.tsx` (reject UX if not already covered)

**Interfaces:**
- Consumes: `assertPhotoUsable({ purpose: "shop_a_look" })`
- Produces: JSON `{ ok:false, code:"photo_gate", message }` with HTTP 422 before `analyzeInspirationPhoto`

- [ ] **Step 1: Insert gate after image validation, before cache miss expensive path**

In `src/app/api/shop-a-look/route.ts`, after size checks and before (or immediately after cache miss, **before** `analyzeInspirationPhoto`):

```ts
const gate = await assertPhotoUsable({
  imageDataUrl: image,
  purpose: "shop_a_look",
});
if (!gate.ok) {
  return NextResponse.json(
    {
      ok: false,
      slots: [],
      code: "photo_gate",
      message: gate.rejectReason,
    },
    { status: 422 },
  );
}
```

Prefer running the gate **even on cache hit of match results?** No — if a prior successful match exists for this hash, skip gate (photo already proved usable). Run gate only when about to call `analyzeInspirationPhoto`.

- [ ] **Step 2: Client surfaces `photo_gate` message — order the checks correctly**

⚠️ The existing match path in `ShopALookExperience.tsx` (~line 311) does `if (!res.ok) throw new Error(data.message ?? data.error)`. A 422 gate reject would hit that throw and land in the generic error/retry UX the plan warns against. So the code returns `message` (which the client already reads) — good — but the client must **check `data.code === "photo_gate"` BEFORE the generic `!res.ok` throw**, set the reject copy in the inline error state, and `return` without offering a retry. Do not rely on the message alone; branch on the code first.

- [ ] **Step 3: Manual sanity (dev)**

Run: upload a landscape photo to Shop a Look with gates on → expect reject copy about clothing. Upload a flat-lay → expect match pipeline to proceed.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/shop-a-look/route.ts src/components/ShopALookExperience.tsx
git commit -m "$(cat <<'EOF'
feat(photo-gate): gate Shop a Look uploads for visible clothing

EOF
)"
```

---

### Task 5: Report wizard role gates

**Files:**
- Modify: `src/app/start/StartForm.tsx`

**Interfaces:**
- Consumes: `checkPhotoGateClient` with purposes `report_face` | `report_full` | `report_profile`
- Gate **before** `stagePhoto` and **before** `uploadPhoto`

- [ ] **Step 1: Add helper mapping**

```ts
function gatePurposeForRole(
  role: string,
): "report_face" | "report_full" | "report_profile" | null {
  if (role === "face") return "report_face";
  if (role === "full") return "report_full";
  if (role === "profile") return "report_profile";
  return null;
}
```

- [ ] **Step 2: Wrap file accept path**

Where the file input calls `stagePhoto(role, file)` / `uploadPhoto(role, file)` (~line 983):

```ts
const purpose = gatePurposeForRole(role);
if (purpose) {
  setUploadingRole(role); // reuse spinner
  const gate = await checkPhotoGateClient({ file, purpose });
  if (!gate.ok) {
    setUploadingRole(null);
    // show gate.error in existing inline error/toast state for that role
    return;
  }
}
await (draftMode ? stagePhoto(role, file) : uploadPhoto(role, file));
```

Add a small `photoGateError` state keyed by role or a single banner string near the photo step.

⚠️ **Latency note.** Each role is a separate round-trip to Flash-Lite, so three photos = three sequential gate waits inside an already-long wizard, before the user has paid. The `setUploadingRole(role)` spinner reuse above is **required, not optional** — the user must see "checking photo…" and not a frozen button. If photos are ever selected as a batch, gate them in parallel (`Promise.all`), not in series.

- [ ] **Step 3: Verify deferred-registration path**

Anon draft: rejected photo must **not** appear in `stagedRoles` / IndexedDB.

- [ ] **Step 4: Commit**

```bash
git add src/app/start/StartForm.tsx
git commit -m "$(cat <<'EOF'
feat(photo-gate): validate report face/full/profile before staging

EOF
)"
```

---

### Task 6: Catalog try-on upload gate

**Files:**
- Modify: `src/components/TryOnButton.tsx`

**Interfaces:**
- Consumes: `checkPhotoGateClient({ file, purpose: "tryon_full" })`
- Gate at start of `uploadFullPhoto`, before Storage upload

- [ ] **Step 1: Gate inside `uploadFullPhoto`**

```ts
async function uploadFullPhoto(file: File) {
  if (!LIVE) return;
  setUploading(true);
  setMsg(null);
  try {
    const gate = await checkPhotoGateClient({
      file,
      purpose: "tryon_full",
    });
    if (!gate.ok) {
      setMsg(gate.error);
      setState("error");
      return;
    }
    // existing upload + /api/photos POST…
  } finally {
    setUploading(false);
  }
}
```

While checking, button label may show “Checking photo…” if easy (optional; “Uploading…” already covers wait).

- [ ] **Step 2: Manual check**

Upload a face-only crop in try-on → reject asking for full-length. Upload full-length → saves as today.

- [ ] **Step 3: Commit**

```bash
git add src/components/TryOnButton.tsx
git commit -m "$(cat <<'EOF'
feat(photo-gate): require full-length photo for catalog try-on upload

EOF
)"
```

---

### Task 7: `/colours` usability gate — folded into the vision call (SUPERSEDES the MediaPipe design below)

**Implemented approach (2026-08-05):** no MediaPipe, no new client code. A `usable: boolean` +
`usableReason` field was added to the `analyzeColoursOnly` schema (`src/lib/ai/colour-analysis.ts`),
which now returns a discriminated `{ ok: true; result } | { ok: false; reason }`. `POST /api/colours`
rejects `ok:false` with `422 { unusable: true, error }` and emits `photo_gate_reject` server-side;
`ColoursExperience.handleFile` branches on `data.unusable` before its generic throw. Zero client
weight, one vision call, proper reject copy.

**Files touched:** `src/lib/ai/colour-analysis.ts`, `src/app/api/colours/route.ts`,
`src/components/ColoursExperience.tsx`. No `@mediapipe/tasks-vision`, no `public/mediapipe`, no
`scripts/setup-mediapipe.mjs`, no `prebuild`.

<details><summary>Original MediaPipe design (NOT built — kept for context)</summary>

**Files:**
- Create: `src/lib/client/face-detect.ts`
- Create: `src/lib/client/face-detect-flags.ts` (or read `NEXT_PUBLIC_*` inline)
- Modify: `src/components/ColoursExperience.tsx`
- Modify: `package.json` (add `@mediapipe/tasks-vision`)

**Interfaces:**
- Produces:
  - `export async function detectReadableFace(file: File | ImageBitmap): Promise<{ ok: true } | { ok: false; reason: string }>`
  - Fail-open on library load failure
  - Skip entirely when `!isPhotoGateActive(resolvePhotoGateFlags({ NEXT_PUBLIC_… }), "colours")`

- [ ] **Step 1: Add dependency + self-host assets**

```bash
npm install @mediapipe/tasks-vision
```

Then copy the wasm fileset and the `blaze_face_short_range.tflite` model into `public/mediapipe/` (from `node_modules/@mediapipe/tasks-vision` and the pinned model release). Serve both from same-origin `/mediapipe/...`, **not** jsdelivr/googleapis (constraints). This keeps the colours wow-moment off an external CDN and pins versions with the package.

- [ ] **Step 2: Implement face-detect module**

```ts
// src/lib/client/face-detect.ts
import {
  FaceDetector,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import {
  isPhotoGateActive,
  resolvePhotoGateFlags,
} from "@/lib/photo-gate-flags";

let detectorPromise: Promise<FaceDetector | null> | null = null;

function coloursGateOn(): boolean {
  return isPhotoGateActive(
    resolvePhotoGateFlags({
      NEXT_PUBLIC_PHOTO_GATE_ENABLED:
        process.env.NEXT_PUBLIC_PHOTO_GATE_ENABLED,
      NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED:
        process.env.NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED,
      PHOTO_GATE_ENABLED: process.env.NEXT_PUBLIC_PHOTO_GATE_ENABLED,
      PHOTO_GATE_COLOURS_ENABLED:
        process.env.NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED,
    }),
    "colours",
  );
}

async function getDetector(): Promise<FaceDetector | null> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        // Same-origin, self-hosted (Step 1) — no external CDN on the wow-moment path.
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        return FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "/mediapipe/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "IMAGE",
        });
      } catch (err) {
        console.error("[face-detect] init failed", err);
        return null;
      }
    })();
  }
  return detectorPromise;
}

// Accept ImageBitmap only — its `.width`/`.height` are intrinsic pixels.
// (An HTMLImageElement would need `naturalWidth`; keeping the type narrow avoids
// the layout-vs-intrinsic footgun and a dead `: 1` fallback branch.)
export async function detectReadableFace(
  source: ImageBitmap,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!coloursGateOn()) return { ok: true };
  const detector = await getDetector();
  if (!detector) return { ok: true }; // fail-open — CALLER emits photo_gate_failopen

  const result = detector.detect(source);
  const faces = result.detections ?? [];
  if (faces.length === 0) {
    return {
      ok: false,
      reason:
        "We couldn't clearly see a face. Try a brighter, front-facing selfie.",
    };
  }
  // Bounding box area ≥ ~4% of frame (tune in impl).
  const box = faces[0].boundingBox;
  if (!box) return { ok: true };
  const area = (box.width * box.height) / (source.width * source.height);
  if (area < 0.04) {
    return {
      ok: false,
      reason:
        "Move a bit closer — we need a clearer view of your face for colour analysis.",
    };
  }
  return { ok: true };
}
```

Assets are self-hosted from `/mediapipe/` (Step 1) — no CDN URL to pin, version travels with the package.

- [ ] **Step 3: Wire into `ColoursExperience.handleFile`**

Before `fetch("/api/colours")`:

```ts
const bitmap = await createImageBitmap(file);
const face = await detectReadableFace(bitmap);
bitmap.close?.();
if (!face.ok) {
  setPhase("error");
  setError(face.reason);
  // emit photo_gate_reject { purpose: "colours" }
  return;
}
```

If `getDetector()` returned null (load failure) the call fail-opens to `{ ok:true }` — emit `photo_gate_failopen { purpose:"colours" }` in that branch so a broken self-hosted asset is visible, not silent.

Use the existing error phase UI (or idle + message) — do not start “analyzing” spinner for rejects.

- [ ] **Step 4: Manual check**

- Non-face image → client error, no network call to `/api/colours` (verify in DevTools).
- Clear selfie → proceeds.
- Set `NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED=false` → non-face still calls API (gate off).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/client/face-detect.ts src/components/ColoursExperience.tsx
git commit -m "$(cat <<'EOF'
feat(photo-gate): client MediaPipe face check before colours analysis

EOF
)"
```

</details>

---

### Task 8: Observability events (required) + env checklist + verification

**Files:**
- Modify: `src/app/api/events/route.ts`
- Modify: `.env.local` (local defaults / comments only — do not commit secrets)

- [ ] **Step 1: Whitelist gate events — REQUIRED, not optional**

`src/app/api/events/route.ts` already exists with an `ALLOWED` set and a rate gate (A1 shipped). Add `"photo_gate_pass"`, `"photo_gate_reject"`, and `"photo_gate_failopen"` to `ALLOWED`. Fire from both the client helpers and the server gate callers with `{ purpose }`.

**Why this is a blocker, not a nicety:** every gate fail-opens on provider/timeout/parse/model-id errors. A gate pointed at a wrong `AI_MODEL_VISION_GATE` fails open 100% of the time — rejects nothing, spends on vision anyway, and is completely invisible without `photo_gate_failopen`. The canary rollout in Global Constraints depends on watching this rate on preview before flipping prod on. Skipping this ships a feature that can be silently dead. Emit points:
- server `assertPhotoUsable` catch → caller emits `photo_gate_failopen`;
- `provider_error` / `no_ai` skip → `photo_gate_failopen`;
- MediaPipe null/detect throw on `/colours` → `photo_gate_failopen`;
- reject → `photo_gate_reject { purpose, kind? }` (log `kind` for shop_a_look);
- pass → `photo_gate_pass { purpose }`.

- [ ] **Step 2: Document env for Vercel**

Ensure production/preview can set:

```
AI_MODEL_VISION_GATE=google/gemini-2.5-flash-lite
PHOTO_GATE_ENABLED=true
PHOTO_GATE_SHOP_A_LOOK_ENABLED=true
PHOTO_GATE_REPORT_PHOTOS_ENABLED=true
PHOTO_GATE_TRYON_ENABLED=true
NEXT_PUBLIC_PHOTO_GATE_ENABLED=true
NEXT_PUBLIC_PHOTO_GATE_COLOURS_ENABLED=true
```

If the Gateway model id differs, adjust `AI_MODEL_VISION_GATE` only.

This block is the **eventual** production state. Per the canary rule (Global Constraints), the shipping commit sets `PHOTO_GATE_ENABLED=false` in prod; you set the flags above to `true` only after the preview environment shows an acceptable `photo_gate_failopen` rate.

- [ ] **Step 3: Full verification**

```bash
node --test --import tsx src/lib/photo-gate-flags.test.ts src/lib/photo-gate-types.test.ts
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
```

Manual matrix:

| Purpose | Good photo | Bad photo | Flag off |
|---|---|---|---|
| colours | selfie proceeds | landscape blocked client-side | landscape hits API |
| shop_a_look | flat-lay proceeds | food rejected | food hits vision |
| report_face | portrait ok | full-body-only rejected | accepted |
| report_full / tryon | head-to-toe ok | face crop rejected | accepted |
| report_profile | side ok | front-only rejected | accepted |

- [ ] **Step 4: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "$(cat <<'EOF'
chore(photo-gate): verify build and document gate env vars

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| `/colours` MediaPipe face detect | 7 |
| Shop a Look clothing kinds | 2, 4 |
| Report face/full/profile | 2, 3, 5 |
| Catalog try-on full-length | 2, 3, 6 |
| Env kill-switches + master | 1 |
| `AI_MODEL_VISION_GATE` | 1, 2 |
| Fail-closed reject / fail-open outage | 2, 3, 7 |
| Fail-open is observable (`photo_gate_failopen`) | 8 (required) |
| Gate before IndexedDB staging | 5 |
| No expensive pipeline on reject | 4–7 |
| Self-hosted MediaPipe assets (no runtime CDN) | 7 |
| Canary rollout (ship master-off, flip on after preview) | Global Constraints |

## Deviations during implementation (2026-08-05)

- **No `src/lib/ai/photo-gate.test.ts`.** `server-only` cannot be imported under `node --test`
  (`ERR_MODULE_NOT_FOUND` — it is a Next-bundler shim), so a node unit test of the server module is
  the wrong tool. The pure logic it would have covered (`purposeToFlagKey`, `userMessageForReject`)
  is tested in `photo-gate-types.test.ts`; the server module is covered by `tsc` + the manual matrix.
- **No MediaPipe at all (reversed 2026-08-05).** The client face detector would have pulled ~12 MB of
  wasm to the browser on the first photo pick — a stall + egress at the wow-moment, to save one cheap
  A0-capped vision call. Replaced by a `usable` flag folded into the colours vision call. The
  `@mediapipe/tasks-vision` dependency, `face-detect.ts`, `scripts/setup-mediapipe.mjs`,
  `public/mediapipe/`, the `prebuild` step and the gitignore entry were all removed. See the revision
  note at the top and the rewritten Task 7.
- **`userMessageForReject` dropped its unused `_modelReason` param** (lint) — re-add when logging the
  model's reason becomes useful.
- **Verified, not committed.** Tests / tsc / lint / build all green; commits left to the maintainer
  (working tree also holds unrelated in-progress changes).

## Placeholder / consistency self-review

- `PhotoGatePurpose` + pure helpers live in `src/lib/photo-gate-types.ts` (not `server-only`) **from Task 2** so client helpers import them without a mid-plan move; `photo-gate.ts` holds only `assertPhotoUsable`.
- `createAdminSupabase` (if ever needed) is `@/lib/supabase/server` — there is no `@/lib/supabase/admin`. The gate holds no cache and imports no admin client.
- No gate-result Storage cache: Flash-Lite is too cheap to justify a third orphan-blob source (spec §3.2).
- Flag key names match across Task 1 (`shopALook`, `reportPhotos`, `tryon`, `colours`) and Task 2 `purposeToFlagKey`.
- HTTP 422 + `code: "photo_gate"` / `"rejected"`; Shop a Look client branches on `code` **before** the generic `!res.ok` throw so a reject isn't shown as a retryable error.
- MediaPipe assets are self-hosted from `/mediapipe/` — no CDN URL to pin.
- `photo_gate_failopen` events are required (Task 8), and the plan ships master-off for a preview canary before prod.
- No TBD steps remain.
