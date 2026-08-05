# Colours share card reference design

## Goal

Reproduce the supplied editorial palette card as closely as practical while
keeping every share image dynamic. The card must use the user's actual
eight-colour palette, subseason, undertone, and contrast.

## Formats

- Vertical Story/Pinterest cards retain the reference's top-to-bottom layout.
- Horizontal social previews adapt the same visual language: identity and
  result on the left, fabric palette on the right.

## Visual structure

- Near-black cloth background with subtle woven grain and overlapping,
  diagonally folded fabric panels.
- Fine brass perimeter rule and low-contrast tailoring pattern lines,
  including curves, seams, construction guides, and notches.
- A large elegant calligraphic `V` monogram behind the content, with extended
  ornamental flourishes.
- Eight fabric samples in two rows. Each sample has realistic weave,
  highlights, shadows, pinked edges, and a slightly different rotation.
- Existing Valetti masthead, result typography, dress-form ornament, footer
  copy, and URL remain legible and follow the supplied reference.

## Rendering approach

Keep the current server-rendered Satori/`ImageResponse` architecture. Build the
background, monogram ornaments, tailoring lines, and fabric samples from
Satori-compatible inline SVG and styled layout elements. Do not create twelve
static seasonal images: the same renderer supports all twelve subseasons and
preserves user-specific metadata.

## Compatibility and fallback

- Use only SVG features supported by Satori/resvg.
- Continue flattening output to JPEG for social-network compatibility.
- Preserve the existing static brand-image fallback if rendering fails.
- Ensure text and palette remain readable when optional undertone or contrast
  values are absent.

## Verification

- Typecheck and lint the changed renderer.
- Render vertical and horizontal examples locally using at least two visually
  different seasons.
- Inspect generated images for clipping, hierarchy, swatch texture, rotation,
  monogram appearance, and similarity to the supplied reference.
