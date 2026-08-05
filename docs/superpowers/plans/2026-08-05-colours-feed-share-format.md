# Colours 4:5 Feed Share Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a downloadable 1080×1350 Facebook/Instagram palette card to the `/colours` result.

**Architecture:** Extend the shared format parser and size map with `feed`, then add a compact mode to the existing `VerticalCard`. Expose the format through a third download action without changing Stories, Pinterest, or horizontal Open Graph behavior.

**Tech Stack:** Next.js 16, React 19, `next/og` ImageResponse, Satori/resvg, Sharp, TypeScript.

## Global Constraints

- Output size must be exactly 1080×1350.
- Recompose the card; do not crop the Stories output.
- Preserve all current dynamic palette and metadata values.
- Do not change existing output formats.
- Do not commit unless explicitly requested.

---

### Task 1: Add and test the feed format

**Files:**
- Modify: `src/lib/og/formats.ts`
- Create: `src/lib/og/formats.test.ts`

**Interfaces:**
- Produces: `VerticalFormat = "story" | "pin" | "feed"`
- Produces: `VERTICAL_SIZE.feed = { width: 1080, height: 1350 }`

- [ ] Write failing tests for parsing and dimensions.
- [ ] Add `feed` to the type, size map, and parser.
- [ ] Run the focused format tests.

### Task 2: Add the download action

**Files:**
- Modify: `src/components/ColoursExperience.tsx`
- Modify: `src/components/ColoursExperience.test.ts`

**Interfaces:**
- Produces a `format=feed` URL and `-feed.jpg` filename.

- [ ] Add a failing assertion for the feed download configuration.
- [ ] Add the `Facebook / Instagram · 4:5` action beside the existing actions.
- [ ] Run the focused component test.

### Task 3: Adapt and verify the renderer

**Files:**
- Modify: `src/lib/og/colours-share-card.tsx`
- Modify: `src/lib/og/colours-share-card.test.ts`

**Interfaces:**
- Consumes: `VerticalFormat`, including `feed`.
- Produces: a compact 1080×1350 image through the existing route.

- [ ] Add a failing test for feed-specific compact layout values.
- [ ] Introduce feed-aware spacing, title, watermark, tile, emblem, and footer scales.
- [ ] Render a Soft Summer feed image and visually inspect all safe areas.
- [ ] Run focused tests, typecheck, lint, and production build.
