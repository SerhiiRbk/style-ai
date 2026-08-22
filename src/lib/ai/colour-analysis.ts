import "server-only";
import { env, hasAI } from "@/lib/env";
import {
  subseasonLabel,
  carloNoteFor,
  paletteForPerson,
  type ColourAnalysisResult,
} from "@/lib/colour-palette";
import { analyzeColoursWith, type ColoursAnalysis } from "./colour-analysis-core";

export type { ColoursAnalysis };

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
    palette: paletteForPerson(subseason, {
      undertone: "warm",
      contrast: "medium",
    }),
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
 *
 * Model is `env.modelVisionColours` (its own env slot, defaults to the report
 * vision model) so it can be tuned/cheapened independently — see
 * `scripts/eval-colours-model.ts`. `opts.model` overrides it (used by the eval).
 */
export async function analyzeColoursOnly(
  imageDataUrl: string,
  opts?: { model?: string },
): Promise<ColoursAnalysis> {
  if (!hasAI) return { ok: true, result: mockResult() };
  return analyzeColoursWith(imageDataUrl, opts?.model ?? env.modelVisionColours);
}
