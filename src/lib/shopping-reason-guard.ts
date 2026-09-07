// Deterministic safety guard for model-written shopping "why" copy.
// Kept free of "server-only" / AI SDK imports so it is unit-testable under
// node:test (same pattern as colour-analysis-core.ts).
import {
  isClassicBusinessLeather,
  type AvoidSwatch,
} from "@/lib/style-extras";

/**
 * Materials the model may only mention when they appear in the item's own
 * title/colour. "down" counts as a material only before jacket/coat/etc. so
 * ordinary copy like "dress it down" isn't rejected.
 */
const MATERIAL_RE =
  /\b(leather|suede|nubuck|wool|merino|cashmere|linen|silk|denim|corduroy|velvet|satin|fleece|down(?=[-\s](?:jacket|coat|vest|gilet|parka|puffer|fill(?:ed)?|padded|padding)))\b/gi;

/** Internal marker tokens the model must never echo into user-facing prose. */
const JARGON_RE = /\b(similar\s*pick|candidate\s*index|heroWhy|reasonVersion)\b/i;

/**
 * Deterministic guard against hallucinated copy: a reason may not claim a
 * material absent from the item itself, must not leak an internal marker token,
 * and must stay one sentence-sized line. Failing reasons fall back to the
 * template "why" — no retry.
 */
const PALETTE_FRAME_RE =
  /\b(palette|colouring|coloring|complexion|undertone|soft summer|best colo(?:u)?rs?)\b/i;

function avoidColorNeedles(avoid: AvoidSwatch[]): string[] {
  const out: string[] = [];
  for (const a of avoid) {
    const name = (a.name ?? "").toLowerCase();
    if (/\bblack\b/.test(name)) out.push("black");
    if (/yellow|mustard|gold/.test(name)) out.push("yellow", "mustard", "golden");
    if (/orange/.test(name)) out.push("orange");
    if (/rust/.test(name)) out.push("rust");
  }
  return [...new Set(out)];
}

export function reasonIsSafe(
  why: string,
  item: { title: string; color?: string | null },
  avoid: AvoidSwatch[] = [],
): boolean {
  const text = why.trim();
  if (text.length < 40 || text.length > 260) return false;
  if (JARGON_RE.test(text)) return false;
  const known = `${item.title} ${item.color ?? ""}`.toLowerCase();
  for (const m of text.matchAll(MATERIAL_RE)) {
    if (!known.includes(m[0].toLowerCase())) return false;
  }
  const lower = text.toLowerCase();
  for (const needle of avoidColorNeedles(avoid)) {
    if (!new RegExp(`\\b${needle}\\b`, "i").test(lower)) continue;
    if (needle === "black" && isClassicBusinessLeather(item.title)) {
      if (PALETTE_FRAME_RE.test(text)) return false;
      continue;
    }
    return false;
  }
  return true;
}
