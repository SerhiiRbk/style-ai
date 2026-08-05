# Colours Share Card Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dynamic vertical and horizontal colour-palette share cards closely reproduce the supplied editorial Valetti reference.

**Architecture:** Extend the existing `ImageResponse` renderer with Satori-compatible inline SVG layers for cloth grain, folded fabric, tailoring marks, and the ornamental monogram. Keep one dynamic renderer for all twelve subseasons and reuse the same visual primitives in both aspect ratios.

**Tech Stack:** Next.js 16 `next/og`, React 19, Satori/resvg-compatible SVG, Sharp JPEG flattening, bundled TTF fonts.

## Global Constraints

- Use the user's actual eight-colour palette, subseason, undertone, and contrast.
- Support vertical Story/Pinterest and horizontal social-preview formats.
- Use only SVG/CSS features supported by Satori/resvg.
- Preserve JPEG output and the existing static fallback.
- Do not create twelve static seasonal images.
- Do not create a git commit unless the user explicitly requests it.

---

### Task 1: Build the reference-style art layers

**Files:**
- Modify: `src/lib/og/colours-share-card.tsx`

**Interfaces:**
- Consumes: `hex: string`, target image dimensions, and the existing bundled `Pinyon` font.
- Produces: reusable data-URI helpers and visual components consumed by both card layouts.

- [ ] **Step 1: Strengthen the fabric swatch renderer**

Update `fabricSwatchDataUri()` to combine multiple fine weave patterns, a restrained diagonal sheen, edge darkening, and subtle thread irregularity using deterministic SVG paths. Keep the existing pinked outline.

Each `SwatchTile` must accept a rotation:

```tsx
function SwatchTile({
  hex,
  tileW,
  tileH,
  radius,
  rotation = 0,
}: {
  hex: string;
  tileW: number;
  tileH: number;
  radius: number;
  rotation?: number;
}) {
  // Existing tile and fabric image, transformed as one physical sample.
}
```

- [ ] **Step 2: Add a dark cloth background**

Create a Satori-compatible `clothBackgroundDataUri(width, height)` that renders:

```svg
<pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse">
  <path d="M0 1H8 M0 5H8" stroke="#fff" stroke-opacity=".018"/>
  <path d="M1 0V8 M5 0V8" stroke="#000" stroke-opacity=".12"/>
</pattern>
```

Overlay large dark polygonal fabric panels and a diagonally folded top-right cloth piece. Use gradients and weave lines instead of unsupported SVG filters.

- [ ] **Step 3: Match the tailoring artwork**

Replace generic geometric guides with asymmetrical tailoring-pattern paths, dashed seam allowances, arcs, notches, and a fine brass border. Keep the artwork low contrast so it never competes with text.

Render the watermark with the Pinyon `V`, enlarged and vertically centred, plus a second ornamental loop/curve so the silhouette resembles the supplied monogram instead of a plain letter.

- [ ] **Step 4: Run static checks**

Run:

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.json
npx eslint src/lib/og/colours-share-card.tsx
```

Expected: both commands exit successfully.

---

### Task 2: Recompose vertical and horizontal layouts

**Files:**
- Modify: `src/lib/og/colours-share-card.tsx`

**Interfaces:**
- Consumes: the art primitives from Task 1 and `ColoursCardData`.
- Produces: unchanged public functions `renderColoursShareCard(data)` and `renderColoursShareCardVertical(data, format)`.

- [ ] **Step 1: Match the vertical reference composition**

Add the cloth background as the first layer, then place the brass frame, masthead, monogram, title block, palette, dress-form seal, and footer in that order. Use fixed, deterministic sample rotations similar to:

```ts
const SWATCH_ROTATIONS = [-6, 3, -2, 5, 5, -4, 4, 6] as const;
```

The first row should sit slightly higher and overlap the second row visually. Preserve all text-safe margins.

- [ ] **Step 2: Adapt the composition horizontally**

Keep the same background, border, monogram, tailoring marks, tilted swatches, and footer. Place identity/result content in the left half and the 4×2 palette in the right half so neither area becomes compressed.

- [ ] **Step 3: Render contrasting local examples**

With the existing development server, render:

```bash
curl -sS "http://localhost:3000/api/og/colours/soft-summer?u=Cool&c=Medium&format=story" -o /tmp/soft-summer-story.jpg
curl -sS "http://localhost:3000/api/og/colours/warm-autumn?u=Warm&c=High" -o /tmp/warm-autumn-og.jpg
```

Expected: valid 1080×1920 and 1200×630 JPEG images.

- [ ] **Step 4: Visually verify both outputs**

Confirm:

- the dark cloth background and diagonal fold are visible;
- the V reads as an elegant monogram;
- brass pattern lines and border remain subtle;
- all eight colours match their source palette;
- every swatch has textile texture, pinked edges, depth, and a deliberate tilt;
- no text, ornament, or swatch is clipped;
- metadata remains legible with both short and long subseason labels.

- [ ] **Step 5: Re-run project checks**

Run:

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.json
npx eslint src/lib/og/colours-share-card.tsx
npm run build
```

Expected: typecheck, lint, and production build all pass.
