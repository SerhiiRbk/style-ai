import type { Boldness } from "@/lib/style-profile";

/** Seasons `generateExtraLook` can be told to weight the outfit for. */
export type LookBriefSeason = "spring" | "summer" | "autumn" | "winter";

/**
 * Per-`Boldness` guidance woven into the styling brief so the reasoning
 * model's outfit description actually shifts in formality/adventurousness
 * with the client's chosen strictness — not just the palette.
 */
const STRICTNESS: Record<Boldness, string> = {
  conservative: "canonically correct, understated, safe",
  moderate: "modern and balanced",
  experimental: "adventurous — unexpected but wearable combinations",
  statement: "expressive and standout, a clear focal point",
};

/**
 * Prepend season + strictness guidance onto a styling brief for
 * `generateExtraLook` (pipeline.ts). Pure and deterministic — same inputs
 * always produce the same string, and omitting both `boldness` and `season`
 * leaves `brief` byte-for-byte unchanged. Kept in its own dependency-light
 * module (no "server-only", no AI SDK) so it can be unit-tested directly,
 * unlike the rest of pipeline.ts which requires a live model.
 *
 * NOTE: this only shapes the TEXT brief — never the look IMAGE prompt
 * (`generateLookImage`), which is out of scope by design.
 */
export function composeLookBrief(
  brief: string,
  opts: { boldness?: Boldness; season?: LookBriefSeason } = {},
): string {
  const { boldness, season } = opts;
  const seasonNote = season
    ? `Season: ${season} — adjust fabric weight, layering and outerwear accordingly. `
    : "";
  const strictnessNote = boldness
    ? `Strictness: ${boldness} — ${STRICTNESS[boldness]}. `
    : "";
  return `${seasonNote}${strictnessNote}${brief}`;
}
