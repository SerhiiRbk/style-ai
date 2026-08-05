# Colours 4:5 feed share format

## Goal

Add a downloadable Facebook/Instagram feed image to the `/colours` result
screen, rendered at exactly 1080×1350 (4:5).

## User interface

The `Save for social` section gains a third action:

- Label: `Facebook / Instagram · 4:5`
- URL format: `format=feed`
- Download filename suffix: `-feed.jpg`

The existing Stories and Pinterest actions remain unchanged.

## Rendering

Extend the existing vertical-format pipeline with `feed`:

- `feed`: 1080×1350
- Preserve the current textured background, border, serif V watermark,
  typography, eight 4×2 fabric swatches, tailoring emblem, and footer.
- Use a compact layout mode rather than cropping the Stories image.
- Reduce vertical spacing, title size, watermark height, palette size, and
  footer spacing sufficiently to keep every element inside the safe area.
- Keep the same dynamic palette, subseason, undertone, and contrast values.

## Compatibility

- Existing `story`, `pin`, and horizontal Open Graph output must not change.
- Continue returning flattened JPEG output.
- Invalid format values continue to use the horizontal Open Graph card.

## Verification

- Unit-test parsing and dimensions for `feed`.
- Unit-test the new download URL and filename configuration.
- Render and visually inspect a 1080×1350 Soft Summer image.
- Run typecheck, lint, and production build.
