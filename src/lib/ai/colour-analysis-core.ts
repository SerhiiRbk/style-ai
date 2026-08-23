/**
 * Colour-analysis core — the vision schema, prompt and mapping, with the model
 * passed in explicitly. **Not `server-only`** so the model-comparison eval
 * (`scripts/eval-colours-model.ts`) can call the exact same logic with
 * different models — no prompt/schema drift between prod and the eval.
 *
 * The server entry point (`colour-analysis.ts`) resolves the model from env and
 * handles the AI-unconfigured mock; this module always makes a real call.
 */
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  classifySubseason,
  refineSeasonForClarity,
} from "@/lib/style-profile";
import {
  assessHexTrust,
  palettePersonWithTrust,
  carloNoteFor,
  paletteForPerson,
  parseSwatchHex,
  refineSeasonFromSkinHex,
  subseasonLabel,
  type ColourAnalysisResult,
} from "@/lib/colour-palette";

export const colourVisionSchema = z.object({
  // Photo-usability gate folded into the same vision call (plan Task 7) — no
  // extra model invocation, zero client weight. False for a landscape, an
  // object, or a face too small/obscured/filtered to read colouring from.
  usable: z
    .boolean()
    .describe(
      "true only if a single human face is clearly visible and readable for colour analysis (not tiny, obscured, or heavily filtered)",
    ),
  usableReason: z
    .string()
    .optional()
    .describe("when usable=false, a short factual reason (for logs)"),
  skinTone: z.string().describe("e.g. 'warm medium', 'cool fair'"),
  undertone: z.enum(["warm", "cool", "neutral"]),
  contrast: z.enum(["low", "medium", "high"]),
  colorSeason: z.enum(["winter", "spring", "summer", "autumn"]),
  clarity: z
    .enum(["muted", "clear"])
    .describe(
      "overall colouring quality by CHROMA/SATURATION, not light/dark contrast: " +
        "'muted' = soft, greyed, dusty, low-saturation; 'clear' = bright, vivid, " +
        "high-saturation. Fair skin with dark hair is high value-contrast but is " +
        "often still 'muted' — judge saturation, not lightness.",
    ),
  hairColor: z
    .string()
    .describe("natural hair colour, e.g. 'dark brown', 'blonde', 'gray'"),
  eyeColor: z.string().describe("eye colour, e.g. 'brown', 'blue', 'green'"),
  skinHex: z
    .string()
    .optional()
    .describe(
      "hex of mid-cheek skin in THIS photo (#rrggbb), no clothing or background",
    ),
  hairHex: z
    .string()
    .optional()
    .describe("hex of the natural hair mass (#rrggbb), not a hat or dye patch"),
  eyeHex: z
    .string()
    .optional()
    .describe("hex of the iris (#rrggbb)"),
  lighting: z
    .enum(["neutral", "warm-tint", "cool-tint", "mixed"])
    .optional()
    .describe(
      "colour cast of the light on the FACE: 'neutral' = daylight / balanced; " +
        "'warm-tint' = orange/yellow indoor bulbs; 'cool-tint' = blue-ish light; " +
        "'mixed' = conflicting sources. Tinted light does NOT make a photo " +
        "unusable — report it honestly, it only flags the hexes as skewed.",
    ),
});

export const COLOUR_VISION_PROMPT =
  "Analyse this photo of a person for a professional, respectful colour analysis. " +
  "First decide if the photo is usable: a single human face must be clearly visible and " +
  "readable — set usable=false for a landscape, an object, no face, or a face too small, " +
  "obscured, dark, or heavily filtered to read colouring from, with a short usableReason. " +
  "If usable, determine skin tone, undertone, facial contrast, natural hair colour and eye " +
  "colour, and read the actual mid-cheek, hair-mass and iris hex (#rrggbb) from this photo. " +
  "Assign a seasonal colour analysis (winter, spring, summer or autumn). " +
  "Also judge overall colouring CLARITY by chroma/saturation ('muted' vs 'clear'): " +
  "muted = soft, greyed, dusty; clear = bright, vivid. Do NOT confuse high light/dark " +
  "(value) contrast — e.g. fair skin with dark hair — for 'clear'; such colouring is " +
  "frequently muted, which points to Summer rather than Winter. " +
  "Also judge the colour cast of the light on the face ('neutral', 'warm-tint', " +
  "'cool-tint' or 'mixed') — tinted light NEVER makes a photo unusable, but report " +
  "it honestly, since it skews the pixel hexes. " +
  "Be objective and tactful — never judgmental.";

/** Discriminated result so callers can reject an unusable photo cleanly. */
export type ColoursAnalysis =
  | { ok: true; result: ColourAnalysisResult }
  | { ok: false; reason: string };

/** Run the colour vision call with an explicit model id. Always makes a real call. */
export async function analyzeColoursWith(
  imageDataUrl: string,
  model: string,
): Promise<ColoursAnalysis> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: colourVisionSchema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: COLOUR_VISION_PROMPT },
          { type: "image", image: imageDataUrl },
        ],
      },
    ],
  });

  if (!output.usable) {
    return {
      ok: false,
      reason:
        "We couldn't read your colours from that photo. Try a clear, well-lit, front-facing selfie.",
    };
  }

  // Correct the base season using the chroma signal (same as the report
  // pipeline): a muted cool/neutral person read as "winter" from value-contrast
  // alone is really a Summer. Keeps `/colours` and the report in lockstep.
  const rawSkinHex = parseSwatchHex(output.skinHex) ?? undefined;
  const rawHairHex = parseSwatchHex(output.hairHex) ?? undefined;
  const rawEyeHex = parseSwatchHex(output.eyeHex) ?? undefined;

  // Lighting gate — never rejects the photo. Season stays categorical unless
  // light is neutral; palette still mixes hexes under ordinary indoor lamps.
  const trust = assessHexTrust({
    lighting: output.lighting,
    contrast: output.contrast,
    undertone: output.undertone,
    skinHex: rawSkinHex,
    hairHex: rawHairHex,
  });
  const seasonHex = trust.useForSeason ? rawSkinHex : undefined;
  const person = palettePersonWithTrust({
    undertone: output.undertone,
    contrast: output.contrast,
    hairColor: output.hairColor,
    eyeColor: output.eyeColor,
    skinTone: output.skinTone,
    skinHex: rawSkinHex,
    hairHex: rawHairHex,
    eyeHex: rawEyeHex,
    lighting: output.lighting,
  });

  const season = refineSeasonFromSkinHex({
    season: refineSeasonForClarity({
      season: output.colorSeason,
      undertone: output.undertone,
      clarity: output.clarity,
    }),
    undertone: output.undertone,
    skinHex: seasonHex,
  });

  const subseason = classifySubseason({
    season,
    undertone: output.undertone,
    contrast: output.contrast,
    clarity: output.clarity,
    hairColor: output.hairColor,
    eyeColor: output.eyeColor,
  });
  const label = subseasonLabel(subseason);

  return {
    ok: true,
    result: {
      season,
      subseason,
      subseasonLabel: label,
      undertone: output.undertone,
      contrast: output.contrast,
      skinTone: output.skinTone,
      hairColor: output.hairColor,
      eyeColor: output.eyeColor,
      skinHex: person.skinHex ?? undefined,
      hairHex: person.hairHex ?? undefined,
      eyeHex: person.eyeHex ?? undefined,
      lighting: output.lighting,
      ...(trust.lightingWarning
        ? { lightingWarning: trust.lightingWarning }
        : {}),
      palette: paletteForPerson(subseason, person),
      carloNote: carloNoteFor({
        season,
        subseasonLabel: label,
        undertone: output.undertone,
        contrast: output.contrast,
      }),
    },
  };
}
