import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import type { LookGarment } from "@/lib/style-extras";

/**
 * "Shop a Look" garment detection. One vision call reads an outfit photo (on
 * anyone — a friend, a celebrity, an editorial shot) and returns a structured
 * breakdown of the individual garments plus the look's palette. The garments are
 * shaped as {@link LookGarment} so they flow straight into the existing
 * catalogue matching stack (`matchInspirationItems`).
 *
 * The photo is used ONLY to describe garments — never persisted here and never
 * used as a face reference for rendering (see docs/shop-a-look-plan.md §3).
 */

/** Catalogue categories the matcher understands — mirrors catalog.ts CATEGORIES. */
const CATALOG_CATEGORIES = [
  "Outerwear",
  "Knitwear",
  "Shirts",
  "Trousers",
  "Footwear",
  "Accessories",
] as const;
type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

/** Map a free-text category / garment word to one of the catalogue categories. */
function normalizeCategory(rawCategory: string, garment: string): CatalogCategory | null {
  const c = `${rawCategory} ${garment}`.toLowerCase();
  const exact = CATALOG_CATEGORIES.find(
    (cat) => cat.toLowerCase() === rawCategory.trim().toLowerCase(),
  );
  if (exact) return exact;
  if (/(shoe|loafer|sneaker|boot|trainer|sandal|footwear|derby|brogue|oxford)/.test(c))
    return "Footwear";
  if (/(coat|jacket|blazer|overcoat|overshirt|trench|parka|bomber|peacoat|suit|outerwear)/.test(c))
    return "Outerwear";
  if (/(knit|sweater|jumper|cardigan|hoodie|sweatshirt|pullover|polo|tee|t-shirt|top)/.test(c))
    return "Knitwear";
  if (/(shirt|blouse)/.test(c)) return "Shirts";
  if (/(trouser|pant|chino|jean|short|bottom|slack)/.test(c)) return "Trousers";
  if (/(belt|sunglass|glasses|watch|hat|cap|tie|scarf|bag|jewel|necklace|bracelet|accessor)/.test(c))
    return "Accessories";
  return null;
}

const HEX_RE = /^#?[0-9a-f]{6}$/i;

const inspirationSchema = z.object({
  /** False when the photo shows no discernible clothing (e.g. a landscape). */
  ok: z.boolean(),
  /** Short editorial name for the overall look, e.g. "Smart-casual autumn layers". */
  lookTitle: z.string().max(80),
  /** One or two sentences describing the outfit as a whole. */
  description: z.string().max(400),
  /** Up to 6 dominant outfit colours as hex. */
  palette: z.array(z.string()).max(6),
  /** The individual garments, front to back / top to bottom. */
  garments: z
    .array(
      z.object({
        // Free-text (mapped to a catalogue category in code): a strict enum
        // makes structured-output occasionally fail when the model returns a
        // near-synonym like "Shoes" or "Bottoms".
        category: z.string().max(40),
        /** Specific garment type, e.g. "overshirt", "chinos", "loafers". */
        garment: z.string().min(2).max(40),
        /** Human colour name, e.g. "navy", "oatmeal". Null if unclear. */
        color: z.string().max(40).nullable(),
        /** Coarse colour family for filtering, e.g. "blue", "brown". */
        colorFamily: z.string().max(24).nullable().optional(),
        /** e.g. "solid", "striped", "checked". Optional. */
        pattern: z.string().max(24).nullable().optional(),
        /** e.g. "wool", "denim", "leather". Optional. */
        material: z.string().max(24).nullable().optional(),
        /** Rich free-text descriptor for the catalogue query. */
        clause: z.string().max(120),
      }),
    )
    // A full outfit plus several distinct accessories (belt, sunglasses, watch,
    // necklace…) routinely exceeds 6 items — keep headroom so structured output
    // never fails schema validation on a well-detected look.
    .max(14),
  /**
   * Normalised (0..1) bounding box of the most prominent human face, if any, so
   * the caller can crop it out before using the photo as a garment reference.
   * Null when no face is visible.
   */
  faceBox: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      w: z.number().min(0).max(1),
      h: z.number().min(0).max(1),
    })
    .nullable(),
});

export type InspirationGarment = LookGarment & {
  colorFamily?: string | null;
  pattern?: string | null;
  material?: string | null;
};

export type InspirationAnalysis = {
  ok: boolean;
  /** True when the vision call errored (vs the photo genuinely having no clothing). */
  failed?: boolean;
  lookTitle: string;
  description: string;
  palette: string[];
  garments: InspirationGarment[];
  faceBox: { x: number; y: number; w: number; h: number } | null;
};

function normalizeHex(raw: string): string | null {
  const t = raw.trim();
  if (!HEX_RE.test(t)) return null;
  return (t.startsWith("#") ? t : `#${t}`).toLowerCase();
}

const PROMPT =
  `You are a menswear stylist cataloguing an outfit from a photo so it can be ` +
  `matched to a shop's catalogue. Catalogue everything the person is WEARING. ` +
  `Ignore only the person's identity, pose and the background — never skip an ` +
  `item just because it sits on the face, head, neck or skin.\n\n` +
  `Return each distinct garment as its own entry, top to bottom (outerwear, ` +
  `knitwear/tops, shirts, trousers, footwear, then accessories). List EVERY ` +
  `visible accessory as its own separate entry, each under category ` +
  `"Accessories" (never merge two different accessories into one entry). Be ` +
  `exhaustive with accessories and actively check these zones:\n` +
  `- eyes: sunglasses or glasses (INCLUDE them even though they are on the face)\n` +
  `- head: hat, cap, beanie\n` +
  `- neck: necklace, chain, pendant, tie, scarf, bandana\n` +
  `- wrists/hands: watch, bracelet, rings\n` +
  `- waist: belt\n` +
  `- carried: bag, backpack, holdall\n\n` +
  `For each item, give the catalogue category, a specific garment type, its ` +
  `main colour (a common wearable colour name AND a coarse family — for ` +
  `sunglasses use the FRAME colour, not the lens tint), any obvious pattern and ` +
  `material, and a short descriptive clause a shopper would search with. Merge ` +
  `only true duplicates of the same piece; do not invent garments you cannot ` +
  `see. Do not list tattoos, logos, hair or bare skin as items.\n\n` +
  `Also return up to six dominant OUTFIT colours as hex, and — if a human face ` +
  `is visible — its bounding box as fractions (0..1) of the image width/height, ` +
  `so it can be cropped out. Set ok=false only if there is no wearable clothing ` +
  `in the image at all.`;

/**
 * Detect the garments in an outfit photo. Returns `{ ok: false }` on any failure
 * or when the image has no clothing, so callers can show an honest empty state.
 */
export async function analyzeInspirationPhoto(
  imageDataUrl: string,
): Promise<InspirationAnalysis> {
  const empty: InspirationAnalysis = {
    ok: false,
    lookTitle: "",
    description: "",
    palette: [],
    garments: [],
    faceBox: null,
  };
  if (!hasAI) return empty;

  // One retry — structured output over an image occasionally fails transiently
  // (the model returns prose instead of a valid object, provider hiccup, etc.).
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { output } = await generateText({
        model: env.modelVision,
        output: Output.object({ schema: inspirationSchema }),
        // Low temperature keeps detection consistent run-to-run so accessories
        // like sunglasses don't drop in and out between uploads of one photo.
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image", image: imageDataUrl },
            ],
          },
        ],
      });

      if (!output.ok) return empty; // genuinely no clothing in the photo

      const garments: InspirationGarment[] = [];
      for (const g of output.garments) {
        const category = normalizeCategory(g.category, g.garment);
        if (!category) continue; // unmappable → skip rather than break matching
        garments.push({
          category,
          garment: g.garment.trim().toLowerCase(),
          color: g.color?.trim() ? g.color.trim().toLowerCase() : null,
          colorFamily: g.colorFamily?.trim()?.toLowerCase() ?? null,
          pattern: g.pattern?.trim()?.toLowerCase() ?? null,
          material: g.material?.trim()?.toLowerCase() ?? null,
          clause: g.clause.trim(),
        });
      }
      if (!garments.length) return empty;

      const palette = output.palette
        .map(normalizeHex)
        .filter((h): h is string => Boolean(h));

      return {
        ok: true,
        lookTitle: output.lookTitle.trim() || "Your look",
        description: output.description.trim(),
        palette,
        garments,
        faceBox: output.faceBox,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  console.error("[inspiration] detection failed", lastErr);
  return { ...empty, failed: true };
}
