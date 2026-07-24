# Shop a Look — implementation plan (Valetti)

Feature: the user uploads a photo of an outfit (on anyone — a friend, a celebrity, an editorial shot) → Valetti detects the individual garments → matches the closest pieces from the catalogue, **re-ranked for the user's own colour/fit profile** → optionally renders a virtual try-on **on the user's own photo**. "Screenshot-to-shop, but in your colours and on your body."

**Why this feature (product rationale)**
- **Proven, high-intent pattern** — "Shazam for outfits" (Google/Pinterest Lens, ASOS Style Match). A man sees a look he likes and wants "get me this, or something like it that suits me." Low friction, high delight.
- **Differentiated from generic visual search** — Valetti adds two layers Lens can't: (1) **try-on on the user's body**, (2) **personal suitability** — matches are re-ranked against the user's palette and fit from their report, not just visual similarity. Moat = "this look, in *your* colours, that you can actually buy."
- **Growth** — a natural low-friction, shareable hook (upload any outfit → see it on you), able to run as a standalone free entry point feeding the funnel (see `docs/growth-plan.md`).
- **Reuses existing infra** — vision (`analyzeProfile`-style Claude call), catalogue vector search (`match_products` / `match_product_offers` RPC in `src/lib/data/catalog.ts`), try-on (`src/lib/ai/tryon.ts` + `src/lib/photo-tryon.ts`), and match/scoring helpers (`decomposeLook`, colour/category scores in `src/lib/style-extras.ts`). This is a new composition of parts that already ship.

**Positioning — manage expectations.** Frame as **"closest pieces from your edit, on you, in your colours"** — NOT "find this exact item". The catalogue is finite; the value is the personalised, buyable, try-on-able match, not an exact-product lookup.

---

## 1. UX flow

New entry **`/shop-a-look`** (and an in-app "Shop a look" action):
1. Upload one outfit photo (drag/drop, camera). Client-side downscale (~1024px) before upload.
2. Loading (Carlo-voiced): "Reading the look…".
3. **Detected items** — the AI's breakdown as cards: category, colour, pattern, material, a crop/label. Each item editable (wrong detections are free labelling if corrected).
4. **Matches per item** — 2–3 catalogue products per detected garment, each with image, title, price, "Shop →" (affiliate) and a **palette-fit badge** (✓ in your colours / ✕ off-palette, computed against the user's colour season).
5. **Try it on** (credit-gated) — render the matched outfit **on the user's own stored photo** (not the uploaded reference). Reuses the existing try-on tray.
6. Upsell/cross-sell: "Add these to your wardrobe" (ties to `docs/wardrobe-as-asset-plan.md`), "See a full style report".

### 1.1 Deliberate limits (free vs paid)
- **Free**: detect + match (cheap — see §5). This is the hook.
- **Paid (credits)**: the try-on render (the only expensive op), same as the current `tryon` = 1 credit model.

---

## 2. Matching pipeline

### v1 — description-embedding match (reuses today's stack)
Text embeddings can't see colour/pattern/silhouette directly, so we let the vision model *describe* each garment richly, then match on that description — reusing the existing text-embedding + `match_products` path.

1. **Detect** — one Claude vision call (`env.modelVision`, `anthropic/claude-sonnet-4.5`) → structured list of garments, each `{ category, colour, colourFamily, pattern, material, style, formality }`. (Same shape/discipline as `analyzeProfile` in `src/lib/ai/pipeline.ts`.)
2. **Embed** — per garment, build a query string ("navy textured wool overshirt, casual, matte") → `embed` with `env.embedModel` (`openai/text-embedding-3-small`).
3. **Search** — `match_products` / `match_product_offers` RPC (pgvector) filtered by `category`, `gender`, `colourFamily`, offer country/currency.
4. **Re-rank for the user** — apply the existing suitability scores (palette fit vs colour season, fit vs body type, `styleFitScore`/`colorMatchScore` from `style-extras.ts`) so the top match both *looks like* the photo garment and *suits the user*.
5. **Present** top 2–3 per garment.

### v2 — image-CLIP visual match (upgrade)
For genuine photo→product visual similarity, add CLIP-style **image embeddings**: embed every catalogue image once, embed the uploaded garment crop per query, match by cosine. Hybrid-rank with the v1 text score + the suitability re-rank. Bigger accuracy win on colour/pattern/silhouette. Cost is mostly engineering + a new image-vector column (compute is cheap — see §5).

---

## 3. Guardrails (must-get-right)

- **Third-party likeness** — the uploaded photo is used **only to extract garments**. The try-on always renders on the **user's own stored photo**, never on a face from the uploaded image. Block try-on if the user has no stored photo. This avoids processing other people's faces and is legally cleaner.
- **Privacy** — the uploaded reference photo is processed in-request and **not persisted** unless the user explicitly saves it. No storage of third-party images by default.
- **Expectation copy** — "closest pieces from your edit", never "exact match".
- **Empty/weak matches** — when no catalogue item clears a similarity threshold for a garment, say so ("nothing close enough in your palette yet") instead of forcing a bad match.
- **Prefer the image engine for try-on** — one composited render for the whole outfit (see §5), not N single-garment renders.

---

## 4. Credit model

- **Detect + match**: free (the hook).
- **Try-on render**: `CREDIT_COSTS.tryon` = 1 credit (unchanged), one composited outfit render.
- **Re-roll / "try another match"**: gate like `regen` = 1 credit, and **cache detect/match by photo hash** so re-rolls don't re-pay for detection.

---

## 5. Unit economics (COGS per run)

Provider rates are estimates (confirm in billing); order-of-magnitude is reliable. **1 credit ≈ €1** per the current packages (`CREDIT_PACKAGES`: 80 credits / €79).

| Component | Model | Est. cost |
|---|---|---|
| Garment detection (1 vision call) | Claude Sonnet 4.5 | ~1.5¢ (≈1.8k in + 0.6k out tokens) |
| Embeddings (≈4 descriptions) | text-embedding-3-small | <0.01¢ (negligible) |
| Vector search | pgvector / Supabase | ~$0 (already paid) |
| **Try-on render** | image or fal | **dominant — see below** |

**Try-on render (depends on `TRYON_ENGINE`):**
- **image (gemini-image)** — one composited render per outfit: **~3–5¢**.
- **fal FASHN v1.6** — per garment; a 3-piece outfit ×3: **~12–20¢**.

**Per-run totals**
- Detect + match only (no try-on): **~1.5¢** → cheap enough to give away as a hook.
- Full run + 1 composited try-on (image engine): **~5¢**.
- Full run + fal (3 garments): **~16¢**.

**Margin** (credit ≈ €1 ≈ $1.08): try-on sells for 1 credit.
- image engine → COGS ~4¢ → **gross margin ~95%+**.
- fal engine → COGS ~15¢ → **~85%**.

**Cost-control levers**
1. Gate the render with credits; keep detect+match free.
2. Prefer the image engine (one composited render) over fal (N renders) — 3–4× cheaper on multi-garment looks.
3. Cap `renderImage` retries (currently up to 3× on transient failure → worst-case 3× render cost) with backoff.
4. Cache detect/match by photo hash so re-rolls don't re-pay detection.
5. Downscale uploads to ~768–1024px to bound vision image tokens.
6. v2 image-CLIP: one-time catalogue re-embed (~7.6k images) costs single-digit $; per-query image embed is negligible — the cost is engineering, not compute.

**Caveats**
- No confirmed public price for `gemini-3.1-flash-image-preview` (preview id) — the ~3–5¢ render estimate is from comparable Gemini flash-image models; higher pricing scales image-engine COGS linearly.
- fal FASHN per-call ~4–7¢, varies by version.

---

## 6. Risks / watch-outs

- **Match quality is the #1 risk**, not cost. Text embeddings match on *descriptions*, not pixels — colour/pattern/silhouette nuance is lost. Mitigate with rich vision descriptions + suitability re-rank in v1; commit to image-CLIP (v2) if the feature proves out.
- **Catalogue coverage** — finite, specific retailers. A niche garment may have no good match. Threshold + honest empty-state.
- **Expectation gap** — biggest UX killer; solved by copy framing (§3).
- **Re-roll cost creep** — users re-rolling matches multiply render cost; gate + cache (§4, §5).

---

## 7. Build order (phased)

**Phase 1 — the free hook (detect + match).**
1. `/api/shop-a-look` (POST): vision detect → per-garment query embed → `match_products` search → suitability re-rank. No storage of the upload.
2. `/shop-a-look` page + uploader + detected-items + matches UI (reuse `PaletteSwatches`, product cards).
3. Photo-hash cache for detect/match.

**Phase 2 — try-on (paid). ✅ shipped**
4. The user selects pieces (one per detected slot, capped at `MAX_TRYON_ITEMS` = 4) and renders them on their **own default photo** by calling the existing catalogue try-on endpoint `POST /api/tryon` with `productIds` and **no `reportId`** — which resolves the photo via `getCatalogTryOnPhoto` (pinned default → latest full-length) and renders with `generateCatalogTryOnImage`.
   - **Decision:** the uploaded reference photo is NOT fed into the render (no outfit-reference, no face-crop needed) — the render uses only the chosen catalogue garment images on the user's photo, exactly like catalogue try-on. This is the cleanest third-party-likeness guardrail (§3) and required no new endpoint or try-on `kind`.
   - **Cost:** `CREDIT_COSTS.tryon` = 1 credit, charged only after a successful render (existing behaviour).

**Phase 3 — retention / cross-sell.**
5. "Add to wardrobe" hand-off (`docs/wardrobe-as-asset-plan.md`), "See a full report", share card of the assembled look.

**Phase 4 — accuracy upgrade.**
6. v2 image-CLIP embeddings: add product image vectors, per-query image embed, hybrid rank. Tune thresholds on real usage.

---

## 8. Highest-leverage first step
Phase 1 (free detect + match) is cheap (~1.5¢/run), reuses the whole existing stack, and validates the only real risk — match quality — before spending on try-on or the CLIP upgrade. Ship it behind a threshold + honest empty-state, watch match acceptance, then invest in v2 if it lands.
