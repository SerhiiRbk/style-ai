# Valetti investor materials (English)

## Google Slides (recommended)

**Upload the PowerPoint file to Google Drive:**

1. Open [Google Drive](https://drive.google.com)
2. **New → File upload** → select `docs/investors/valetti-investor-deck-en.pptx`
3. Double-click the file → **Open with Google Slides**
4. Charts, tables, diagrams, and brand images are preserved (edit fonts/colours in Slides if needed)

Regenerate the file after content changes:

```bash
npm run deck:pptx
```

The deck includes **14 slides**: cover, problem, product loop, pricing + bar chart, revenue pie chart, unit economics, competition table, SRE architecture diagram, engines, stack, moat, roadmap, closing.

## HTML slideshow (present in browser)

Open `docs/investors/slides/index.html` in Chrome/Safari:

- **Arrow keys** or buttons to navigate
- Press **F** for fullscreen
- **Print → Save as PDF** for slide-by-slide export

## Live web page (admins only)

**https://valetti.fit/investors**

- Restricted to signed-in users whose email is in `ADMIN_EMAILS`
- Not indexed (`noindex`)
- **Save as PDF** — print-friendly export
- **Google Slides (.pptx)** — `/api/admin/investor-deck` (same admin gate; file from `docs/investors/`, regenerate via `npm run deck:pptx`)

## Files in this folder

| File | Purpose |
|------|---------|
| **valetti-investor-deck-en.pptx** | **Google Slides import** — charts, assets, diagrams |
| [slides/index.html](./slides/index.html) | Browser presentation with SVG diagrams |
| [valetti-investor-deck-en.md](./valetti-investor-deck-en.md) | Full deck text — versioned in git |
| [cloud-credits-en.md](./cloud-credits-en.md) | Cloud & AI credits application pack |

## Source of truth in code

Page content is driven by `src/lib/investor-deck-en.ts`. When updating the deck, edit that file and sync the markdown copy.

## Cursor canvases (internal)

Interactive canvases for editing in Cursor IDE:

- `~/.cursor/projects/.../canvases/valetti-investor-deck-en.canvas.tsx`
- `~/.cursor/projects/.../canvases/valetti-cloud-credits-en.canvas.tsx`

These are **not** in git and do not open for external recipients.

## Sharing checklist

1. **VCs / external:** attach PDF or upload `.pptx` to Google Slides — do not share `/investors` (admin-only)
2. **Internal:** sign in as admin → `https://valetti.fit/investors`
3. Or share `docs/investors/valetti-investor-deck-en.md` from the repo
4. Use `founder@valetti.fit` (or your real address) in outreach — update `INVESTOR_DECK_META.contact` in code if needed
