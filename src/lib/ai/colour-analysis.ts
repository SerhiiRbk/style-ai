import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import { classifySubseason } from "@/lib/style-profile";
import {
  carloNoteFor,
  paletteForSubseason,
  subseasonLabel,
  type ColourAnalysisResult,
} from "@/lib/colour-palette";

const schema = z.object({
  skinTone: z.string().describe("e.g. 'warm medium', 'cool fair'"),
  undertone: z.enum(["warm", "cool", "neutral"]),
  contrast: z.enum(["low", "medium", "high"]),
  colorSeason: z.enum(["winter", "spring", "summer", "autumn"]),
  hairColor: z
    .string()
    .describe("natural hair colour, e.g. 'dark brown', 'blonde', 'gray'"),
  eyeColor: z.string().describe("eye colour, e.g. 'brown', 'blue', 'green'"),
});

/** Deterministic fallback when AI is unconfigured — keeps `/colours` usable in dev. */
function mockResult(): ColourAnalysisResult {
  const subseason = "warm-autumn" as const;
  return {
    season: "autumn",
    subseason,
    subseasonLabel: subseasonLabel(subseason),
    undertone: "warm",
    contrast: "medium",
    skinTone: "warm medium",
    palette: paletteForSubseason(subseason),
    carloNote: carloNoteFor({
      season: "autumn",
      subseasonLabel: subseasonLabel(subseason),
      undertone: "warm",
      contrast: "medium",
    }),
  };
}

/**
 * Free colour analysis — a trimmed variant of `analyzeProfile` that only reads
 * the colour-relevant attributes from a single photo, then maps them onto a
 * subseason + palette + a deterministic Carlo note. One AI call, no persistence:
 * the image is passed straight to the vision model as a data URL and never stored.
 */
export async function analyzeColoursOnly(
  imageDataUrl: string,
): Promise<ColourAnalysisResult> {
  if (!hasAI) return mockResult();

  const { output } = await generateText({
    model: env.modelVision,
    output: Output.object({ schema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Analyse this photo of a person for a professional, respectful colour analysis. " +
              "Determine skin tone, undertone, facial contrast, natural hair colour and eye colour, " +
              "and assign a seasonal colour analysis (winter, spring, summer or autumn). " +
              "Be objective and tactful — never judgmental.",
          },
          { type: "image", image: imageDataUrl },
        ],
      },
    ],
  });

  const subseason = classifySubseason({
    season: output.colorSeason,
    undertone: output.undertone,
    contrast: output.contrast,
    hairColor: output.hairColor,
    eyeColor: output.eyeColor,
  });
  const label = subseasonLabel(subseason);

  return {
    season: output.colorSeason,
    subseason,
    subseasonLabel: label,
    undertone: output.undertone,
    contrast: output.contrast,
    skinTone: output.skinTone,
    palette: paletteForSubseason(subseason),
    carloNote: carloNoteFor({
      season: output.colorSeason,
      subseasonLabel: label,
      undertone: output.undertone,
      contrast: output.contrast,
    }),
  };
}
