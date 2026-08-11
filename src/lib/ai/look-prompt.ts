/**
 * =============================================================================
 *  EXPERIMENTAL — look/capsule image-prompt versioning (TEMPORARY SCAFFOLD)
 * =============================================================================
 *
 * This module exists ONLY to A/B different orderings of the look-image prompt
 * without touching the caller. It is deliberately self-contained so it can be
 * deleted in one step once a winner is chosen.
 *
 * Versions are CUMULATIVE — each adds exactly ONE change on top of the previous:
 *   v1  baseline (byte-identical to the historical inline prompt)
 *   v2  v1 + group all hard negatives into one trailing "Constraints —" block
 *   v3  v2 + move subject/framing to the front (scene before clothes)
 *   v4  v3 + move identity (image roles + face anchor) up, right after subject
 *
 * Selection: env `IMAGE_PROMPT_VERSION` (default 1), overridable per-run by a
 * `promptVersion` argument (used by the manual resume/cron path for A/B batteries
 * without a redeploy).
 *
 * -----------------------------------------------------------------------------
 * HOW TO FINALISE (remove the experiment, keep the winner):
 *   1. Pick the winning version N.
 *   2. In pipeline.ts, replace `buildLookImagePrompt(parts, version)` with the
 *      body of `layoutV{N}` (or, if N === 1, just keep `parts.legacyPrompt`,
 *      which is the inline assembly still computed there).
 *   3. Delete this file, the `IMAGE_PROMPT_VERSION` env usage, and the
 *      `promptVersion` plumbing (all optional args — safe to strip).
 * -----------------------------------------------------------------------------
 */

/** The named segments the caller already computes, plus the exact v1 string. */
export type LookPromptParts = {
  /** Exact historical assembly — the single source of truth for v1. */
  legacyPrompt: string;
  /** "Editorial, full-length fashion photograph for a premium style report. " */
  preamble: string;
  /** Gender/age/build + light/pose + 9:16 framing. */
  subject: string;
  /** Catalogue-dominant block OR "Outfit: {description}. " */
  outfitBlock: string;
  /** Dynamic footwear directive (may be ""). */
  footwearBlock: string;
  /** "Colour palette: …. " */
  paletteLine: string;
  /** Near-face colour directive (MUST hex, soft principle, or ""). */
  nearFaceBlock: string;
  /** Image-role sentences (identity), may be "". */
  imageRoles: string;
  /** Face-trait anchor + identity-scoped negatives, may be "". */
  faceAnchor: string;
  /** Positive layering ORDER only, negatives moved to `constraints` (v2+). */
  layeringOrder: string;
  /** Hard negatives grouped for v2+ (no added layers, no denim, no text, …). */
  constraints: string[];
};

export const IMAGE_PROMPT_VERSIONS = [1, 2, 3, 4] as const;
export type ImagePromptVersion = (typeof IMAGE_PROMPT_VERSIONS)[number];
export const DEFAULT_IMAGE_PROMPT_VERSION: ImagePromptVersion = 1;

/**
 * Resolve the active prompt version. Per-run `override` (e.g. `?promptVersion=`)
 * wins over the `IMAGE_PROMPT_VERSION` env; anything unrecognised falls back to
 * the default (never throws — a bad flag must not break generation).
 */
export function resolveImagePromptVersion(
  override?: string | number | null,
): ImagePromptVersion {
  const raw = override ?? process.env.IMAGE_PROMPT_VERSION ?? "";
  const n =
    typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10);
  return (IMAGE_PROMPT_VERSIONS as readonly number[]).includes(n)
    ? (n as ImagePromptVersion)
    : DEFAULT_IMAGE_PROMPT_VERSION;
}

/** One compact trailing block so negatives stop dissolving between descriptions. */
function constraintsSentence(constraints: string[]): string {
  const items = constraints
    .map((c) => c.trim().replace(/\.+$/, ""))
    .filter(Boolean);
  if (!items.length) return "";
  return `Constraints — ${items.join("; ")}.`;
}

const join = (...parts: string[]) => parts.filter(Boolean).join("");

/** v1 — historical baseline, byte-identical to the previous inline prompt. */
function layoutV1(p: LookPromptParts): string {
  return p.legacyPrompt;
}

/** v2 — v1 with hard negatives consolidated into one trailing Constraints block. */
function layoutV2(p: LookPromptParts): string {
  return join(
    p.preamble,
    p.outfitBlock,
    p.layeringOrder,
    p.footwearBlock,
    p.paletteLine,
    p.nearFaceBlock,
    p.subject,
    p.imageRoles,
    p.faceAnchor,
    constraintsSentence(p.constraints),
  );
}

/** v3 — v2 with subject/framing moved to the front (scene before clothes). */
function layoutV3(p: LookPromptParts): string {
  return join(
    p.preamble,
    p.subject,
    p.outfitBlock,
    p.layeringOrder,
    p.footwearBlock,
    p.paletteLine,
    p.nearFaceBlock,
    p.imageRoles,
    p.faceAnchor,
    constraintsSentence(p.constraints),
  );
}

/** v4 — v3 with identity (roles + face anchor) hoisted right after the subject. */
function layoutV4(p: LookPromptParts): string {
  return join(
    p.preamble,
    p.subject,
    p.imageRoles,
    p.faceAnchor,
    p.outfitBlock,
    p.layeringOrder,
    p.footwearBlock,
    p.paletteLine,
    p.nearFaceBlock,
    constraintsSentence(p.constraints),
  );
}

const LAYOUTS: Record<ImagePromptVersion, (p: LookPromptParts) => string> = {
  1: layoutV1,
  2: layoutV2,
  3: layoutV3,
  4: layoutV4,
};

/** Assemble the look/capsule image prompt for the given version. */
export function buildLookImagePrompt(
  parts: LookPromptParts,
  version: ImagePromptVersion = DEFAULT_IMAGE_PROMPT_VERSION,
): string {
  return (LAYOUTS[version] ?? layoutV1)(parts);
}
