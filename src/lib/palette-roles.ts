/**
 * Palette roles: what a swatch IS within a client's best palette — hero,
 * anchor, light or mid neutral — and whether a product colour reads as an
 * accent for that palette. The foundation both the colour rules and the look
 * recipes stand on; it imports nothing above the palette maths.
 */
import { hexToHsl, hueDist } from "@/lib/colour-palette";
import type { ColorRec } from "@/lib/report";

export type SwatchRole = "hero" | "anchor" | "light" | "mid";

export function swatchRole(sw: ColorRec): SwatchRole {
  const { s, l } = hexToHsl(sw.hex);
  if (l <= 0.34 && s < 0.32) return "anchor";
  if (l >= 0.68 && s < 0.22) return "light";
  if (s >= 0.16 && l >= 0.22 && l <= 0.72) return "hero";
  if (l >= 0.55) return "light";
  if (l <= 0.38) return "anchor";
  return "mid";
}

/**
 * Role of the BEST swatch a product colour sits closest to. Hue only counts
 * when both colours carry chroma (a grey's hue is noise); lightness and
 * saturation always do. Null when the palette has no usable swatch.
 */
export function paletteRoleForHex(hex: string, best: ColorRec[]): SwatchRole | null {
  const target = hexToHsl(hex);
  let nearest: ColorRec | null = null;
  let nearestD = Infinity;
  for (const sw of best) {
    if (!sw.hex) continue;
    const c = hexToHsl(sw.hex);
    // Lightness is what separates an anchor from a light neutral — weight it
    // above hue, or a dark brown lands on mushroom because both are "warm".
    const chroma = Math.min(1, target.s + c.s);
    const d =
      (hueDist(target.h, c.h) / 180) * chroma * 0.5 +
      1.5 * Math.abs(target.l - c.l) +
      0.5 * Math.abs(target.s - c.s);
    if (d < nearestD) {
      nearestD = d;
      nearest = sw;
    }
  }
  return nearest ? swatchRole(nearest) : null;
}

/** Saturation at or above which a product reads as colour on any palette. */
const ACCENT_SAT = 0.3;

/**
 * Is this product colour an ACCENT for the client's palette? The old rule was
 * one constant (s ≥ 0.3): on a Soft Summer that made every faithfully muted
 * teal or slate piece a "neutral", so the matrix stacked its one pink shirt on
 * a teal blazer; on a Bright Winter it made navy trousers an accent and greyed
 * cobalt knits away. Here the palette decides: a piece that sits on a hero
 * swatch is an accent however muted; a saturated piece is an accent unless it
 * sits on the palette's dark anchor; everything else is a neutral. Same
 * vocabulary the look recipes use, so looks and capsule agree.
 */
export function isAccentForPalette(hex: string, best: ColorRec[]): boolean {
  const s = hexToHsl(hex).s;
  const role = paletteRoleForHex(hex, best);
  if (!role) return s >= ACCENT_SAT;
  if (s >= ACCENT_SAT) return role !== "anchor";
  return role === "hero";
}
