import "server-only";
import { generateImage, generateText, Output, embed } from "ai";
import { z } from "zod";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  climateFor,
  HAIR_AVOID_GEN_LIMIT,
  hairRecommendGenLimit,
  lookCountForTier,
  mockStyleProfile,
  mockReportContent,
  type Tier,
} from "@/lib/report";
import {
  reportContentSchema,
  lookContentSchema,
  inferBodyTypeFromMeasurements,
  classifySubseason,
  refineSeasonForClarity,
  HAIR_COLOR_LABELS,
  EYE_COLOR_LABELS,
  type EyeColorId,
  type Intake,
  type LookItem,
  type StyleProfile,
  type ReportContent,
  type Boldness,
  seasonForCorrectedUndertone,
  seasonFromColouring,
} from "@/lib/style-profile";
import {
  imageModelChain,
  imageModelUsesChat,
} from "@/lib/ai/image-models";
import {
  composeLookBrief,
  dinnerLayerMatchesSlot,
  LOOK_WEARABLE_RULE,
  partyJacketMatchesSlot,
  sanitizeLookDescription,
  sanitizeLookItems,
  withWearableLookRule,
  type LookBriefSeason,
} from "@/lib/ai/look-brief";
import { lookStyleHasBrief } from "@/lib/look-styles";
import { lookOccasionIdFromContext } from "@/lib/look-contexts";
import { measurePhotoColouring } from "@/lib/ai/photo-colour-measure";
import { reconcileContrast, reconcileUndertone, rgbToHex,
  neutralLean,
} from "@/lib/photo-colour";
import {
  formatLookColorRecipePrompt,
  lookSetColorRecipes,
  recipeHeroHonoured,
  recipeShoeHonoured,
  enforceRecipeShoe,
  enforceRecipeBelt,
  enforceRecipeJacketColour,
  recipePaletteHexes,
  type LookColorRecipe,
} from "@/lib/look-set-color-recipes";
import { planReportLookContexts } from "@/lib/report-look-plan";
import {
  reportPalette,
  annotateNearFaceGuidance,
  assessHexTrust,
  palettePersonWithTrust,
  parseSwatchHex,
  refineSeasonFromSkinHex,
  lightingForTrust,
} from "@/lib/colour-palette";
// EXPERIMENTAL prompt versioning — see look-prompt.ts for how to remove.
import {
  buildLookImagePrompt,
  resolveImagePromptVersion,
  type LookPromptParts,
} from "@/lib/ai/look-prompt";
import {
  faceReattachRole,
  shouldReattachFacePortrait,
} from "@/lib/ai/identity-refs";
import { bodyTypeLock, bodyTypeSubjectClause } from "@/lib/ai/body-lock";
import {
  blazerTypePromptDirective,
  eyewearPromptDirective,
  fabricPromptDirective,
  backpackPromptDirective,
  hatPromptDirective,
  shoeMaterialPromptDirective,
  sneakerPromptDirective,
  tiePromptDirective,
  tuckPromptDirective,
} from "@/lib/look-constructor";
import {
  catalogTryOnGarmentsText,
  pickTryOnGarments,
  upgradeCatalogImageUrl,
} from "@/lib/look-tryon";
import { MAX_TRYON_GARMENTS } from "@/lib/tryon-limits";

export type PhotoInput = {
  role: string;
  url: string;
  /** When the file was uploaded — photos from different shoots are not mixed in one measurement. */
  uploadedAt?: string;
};

type ImagePromptPart =
  | { type: "text"; text: string }
  | { type: "image"; image: URL };

function imagePromptText(content: ImagePromptPart[]): string {
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function imagePromptUrls(content: ImagePromptPart[]): URL[] {
  return content
    .filter((p): p is { type: "image"; image: URL } => p.type === "image")
    .map((p) => p.image);
}

async function fetchImageBytes(url: URL): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function renderViaChat(
  model: string,
  content: ImagePromptPart[],
  attempts: number,
): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await generateText({
        model,
        messages: [{ role: "user", content }],
      });
      const file = result.files.find((f) => f.mediaType.startsWith("image/"));
      if (file) return { bytes: file.uint8Array, mediaType: file.mediaType };
    } catch (err) {
      if (attempt === attempts - 1) {
        console.error("[image] chat model failed", model, err);
      }
    }
    if (attempt < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return null;
}

async function renderViaImageModel(
  model: string,
  content: ImagePromptPart[],
): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  const text = imagePromptText(content);
  const urls = imagePromptUrls(content).slice(0, 8);
  const images = (
    await Promise.all(urls.map((url) => fetchImageBytes(url)))
  ).filter((b): b is Uint8Array => Boolean(b));
  try {
    const result = await generateImage({
      model,
      prompt: images.length ? { images, text } : text,
      maxRetries: 1,
      ...(model.startsWith("openai/")
        ? { size: "1024x1536" as const }
        : { aspectRatio: "9:16" as const }),
    });
    const image = result.image;
    if (!image) return null;
    return { bytes: image.uint8Array, mediaType: image.mediaType };
  } catch (err) {
    console.error("[image] image-only model failed", model, err);
    return null;
  }
}

/**
 * Run an image-generation request with bounded retries, then the configured
 * fallback models (Gemini Pro chat, then GPT Image / Flux Kontext). Returns
 * null so callers can handle a total miss.
 */
async function renderImage(
  content: ImagePromptPart[],
  attempts = 3,
): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  const models = imageModelChain(env.modelImage, env.modelImageFallbacks);
  for (const [i, model] of models.entries()) {
    const tries = i === 0 ? attempts : Math.min(2, attempts);
    const rendered = imageModelUsesChat(model)
      ? await renderViaChat(model, content, tries)
      : await renderViaImageModel(model, content);
    if (rendered) {
      if (i > 0) console.warn("[image] rendered with fallback", model);
      return rendered;
    }
  }
  console.error("[image] generation failed on every model", models);
  return null;
}

/**
 * Strict instruction appended to every image-generation prompt. Image models
 * (esp. when the prompt contains descriptive phrases like "style to avoid")
 * sometimes render that copy as a caption baked into the photo. This forbids
 * any text/graphics in the output.
 */
const NO_TEXT_RULE =
  " Output a clean photographic image only — absolutely no text, letters, " +
  "words, captions, labels, headings, watermarks, logos, numbers, arrows or " +
  "graphic overlays anywhere in the frame.";

/** Matches report UI + PDF portrait slots (aspect 4:5). */
const HEADSHOT_FRAMING =
  "Vertical 4:5 portrait framing, shoulders-up, subject centered in frame. ";

/**
 * Explicit skin-tone lock for identity renders. The image model biases toward
 * warm, tanned, bronzed skin under editorial studio light and darkens genuinely
 * fair complexions; naming the tone/undertone alone is not enough, so we add a
 * hard "do not tan/darken/warm" rule using the analysed skin tone + undertone.
 */
function skinTonePreservationRule(profile: StyleProfile): string {
  const tone = profile.physical.skinTone?.trim();
  const undertone = profile.physical.undertone?.trim();
  const named =
    tone && undertone
      ? `${tone} skin with a ${undertone} undertone`
      : tone
        ? `${tone} skin`
        : undertone
          ? `skin with a ${undertone} undertone`
          : "";
  return (
    `Keep the EXACT skin tone and undertone from the reference photo` +
    (named ? ` — the person has ${named}` : "") +
    `. Do NOT tan, darken, bronze, warm or add colour to the skin; do not deepen ` +
    `the complexion. Render fair, light skin as genuinely fair, and preserve the ` +
    `original undertone (do not shift a cool complexion to warm/olive). `
  );
}

const visionSchema = z.object({
  skinTone: z.string().describe("e.g. 'warm medium', 'cool fair'"),
  undertone: z.enum(["warm", "cool", "neutral"]),
  contrast: z.enum(["low", "medium", "high"]),
  faceShape: z.string().describe("e.g. oval, round, square, oblong, heart"),
  bodyType: z.string().describe("e.g. rectangle, triangle, inverted-triangle"),
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
  eyeHex: z.string().optional().describe("hex of the iris (#rrggbb)"),
  colorSeason: z.enum(["winter", "spring", "summer", "autumn"]),
  clarity: z
    .enum(["muted", "clear"])
    .describe(
      "overall colouring quality by CHROMA/SATURATION, not light/dark contrast: " +
        "'muted' = soft, greyed, dusty, low-saturation; 'clear' = bright, vivid, " +
        "high-saturation. Fair skin with dark hair is high value-contrast but is " +
        "often still 'muted' — judge saturation, not lightness.",
    ),
  lighting: z
    .enum(["neutral", "warm-tint", "cool-tint", "mixed"])
    .optional()
    .describe(
      "colour cast of the light on the FACE across the photos: 'neutral' = " +
        "daylight / balanced; 'warm-tint' = orange/yellow indoor bulbs; " +
        "'cool-tint' = blue-ish light; 'mixed' = conflicting sources. Tinted " +
        "light does NOT make photos unusable — report it honestly, it only " +
        "flags the hexes as skewed.",
    ),
});

function photoRoleLabel(role: string): string {
  if (role === "face") return "close-up face portrait";
  if (role === "full") return "full-length photo";
  if (role === "profile") return "side / three-quarter profile portrait";
  return role || "photo";
}

/** Step 1 — Vision analysis → physical attributes + colour season. */
/**
 * Measured undertone confidence (margin past the boundary / 8°, × sample
 * agreement) at which the season family is derived from the pixels. 0.5 is a
 * 4° margin with every sample agreeing.
 */
const MEASURED_SEASON_MIN_CONFIDENCE = 0.5;

export async function analyzeProfile(
  intake: Intake,
  photos: PhotoInput[],
): Promise<StyleProfile> {
  if (!hasAI || photos.length === 0) return mockStyleProfile(intake);

  const { output } = await generateText({
    model: env.modelVision,
    output: Output.object({ schema: visionSchema }),
    // Colour analysis must be repeatable: the same photos should always yield the
    // same season. A near-zero temperature (plus a fixed seed) removes the run-to-
    // run drift that previously flipped borderline cases between summer and winter.
    temperature: 0,
    seed: 1,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Analyse these photos of a person for a professional, respectful style consultation. ` +
              `Determine skin tone, undertone, facial contrast, face shape, body type, natural hair colour ` +
              `and eye colour, read the actual mid-cheek, hair-mass and iris hex (#rrggbb) from the photos, ` +
              `and assign a seasonal colour analysis. Be objective and tactful — never judgmental. ` +
              `Also judge overall colouring CLARITY by chroma/saturation ('muted' vs 'clear'): ` +
              `muted = soft, greyed, dusty; clear = bright, vivid. Do NOT confuse high light/dark ` +
              `(value) contrast — e.g. fair skin with dark hair — for 'clear'; such colouring is ` +
              `frequently muted, which points to Summer rather than Winter. ` +
              `Also judge the colour cast of the light on the face ('neutral', 'warm-tint', ` +
              `'cool-tint' or 'mixed') — tinted light NEVER makes a photo unusable, but report ` +
              `it honestly, since it skews the pixel hexes. ` +
              `Context: age ${intake.age}, height ${intake.heightCm}cm, ${intake.genderPresentation}.` +
              (intake.hairColor
                ? ` Self-reported hair: ${HAIR_COLOR_LABELS[intake.hairColor]}.`
                : "") +
              (intake.eyeColor
                ? ` Self-reported eyes: ${EYE_COLOR_LABELS[intake.eyeColor]}.`
                : ""),
          },
          // Tell the model which photo is which: the portrait carries the colour
          // read, the full-length shot only body/proportion (its light differs),
          // the profile only face geometry.
          {
            type: "text" as const,
            text:
              `Photos, in order: ` +
              photos
                .map((p, i) => `image ${i + 1} = ${photoRoleLabel(p.role)}`)
                .join("; ") +
              `. Read skin / hair / iris colour and lighting from the face portrait when one is present; ` +
              `use the full-length photo for body type and proportion, the profile shot for face shape only.`,
          },
          ...photos.map((p) => ({ type: "image" as const, image: new URL(p.url) })),
        ],
      },
    ],
  });

  // Self-report takes precedence over the vision estimate for colouring.
  const hairColor = intake.hairColor
    ? HAIR_COLOR_LABELS[intake.hairColor]
    : output.hairColor;
  const eyeColor = intake.eyeColor
    ? EYE_COLOR_LABELS[intake.eyeColor as EyeColorId]
    : output.eyeColor;

  // Correct the base season using the chroma signal: a muted cool/neutral person
  // read as "winter" from value-contrast alone is really a Summer.
  const rawSkinHex = parseSwatchHex(output.skinHex) ?? undefined;
  const rawHairHex = parseSwatchHex(output.hairHex) ?? undefined;
  const rawEyeHex = parseSwatchHex(output.eyeHex) ?? undefined;

  // Pixel-level second opinion: sample skin in the model's boxes (cheeks,
  // forehead, neck, hands / forearms on the full-length photo), correct the
  // light's cast, and derive undertone + contrast from the corrected pixels.
  // The model's verbal read stands only where the measurement is unsure.
  const measured = await measurePhotoColouring(
    photos,
    output.lighting,
    rawSkinHex,
    hairColor,
  );
  const undertone = reconcileUndertone(output.undertone, measured, output.lighting);
  const contrast = reconcileContrast(output.contrast, measured);
  if (measured && (undertone !== output.undertone || contrast !== output.contrast)) {
    console.warn("[vision] pixel measurement overrode the model", {
      model: { undertone: output.undertone, contrast: output.contrast },
      measured: {
        undertone: measured.undertone,
        confidence: Number(measured.undertoneConfidence.toFixed(2)),
        hueAngle: Math.round(measured.undertoneHueAngle),
        spread: measured.contrastSpread == null ? null : Number(measured.contrastSpread.toFixed(2)),
        cast: measured.castDirection,
        bodySkin: measured.bodySkinUsed,
      },
    });
  }
  const measuredSkinHex = measured?.skinHex ?? rawSkinHex;
  const measuredHairHex = measured?.hairHex ?? rawHairHex;
  const hexesCorrected = Boolean(measured);

  // Lighting gate — never rejects photos. Hexes stay on the profile when they
  // may tint the palette (`deterministicColors` re-runs assessHexTrust from
  // stored lighting). Corrected pixel hexes are trusted as if the light were
  // neutral; the model's own hexes under a tint are not.
  const trust = assessHexTrust({
    lighting: hexesCorrected ? "neutral" : output.lighting,
    contrast,
    undertone,
    skinHex: measuredSkinHex,
    hairHex: measuredHairHex,
  });
  if (!trust.useForPalette) {
    console.warn("[vision] photo hexes dropped — palette from categorical signals", {
      lighting: output.lighting ?? "neutral",
      contrast: output.contrast,
    });
  } else if (!trust.useForSeason) {
    console.warn("[vision] photo hexes palette-only — season from categorical signals", {
      lighting: output.lighting ?? "neutral",
      contrast: output.contrast,
    });
  }
  const skinHex = trust.useForPalette ? measuredSkinHex : undefined;
  const hairHex = trust.useForPalette ? measuredHairHex : undefined;
  const eyeHex = trust.useForPalette ? rawEyeHex : undefined;

  // Season family. When the pixels confirm the temperature with confidence it
  // is derived from measured temperature + depth, not from the model's season
  // word (which moved between runs of the same photos). When the pixels
  // overruled the model's undertone the family moves with it; otherwise the
  // model's word stands.
  const measuredDecisive =
    !!measured &&
    measured.undertone !== "neutral" &&
    measured.undertone === undertone &&
    measured.undertoneConfidence >= MEASURED_SEASON_MIN_CONFIDENCE;
  // A neutral client's family follows the lean of the measured hue
  // (neutral-cool → summer / winter, neutral-warm → spring / autumn).
  const lean = undertone === "neutral" ? neutralLean(measured) : null;
  const familyTemperature: "warm" | "cool" | null = measuredDecisive
    ? (measured.undertone as "warm" | "cool")
    : lean;
  const seasonBase = familyTemperature
    ? seasonFromColouring({ undertone: familyTemperature, contrast, hairColor, eyeColor })
    : undertone !== output.undertone
      ? seasonForCorrectedUndertone({
          season: output.colorSeason,
          undertone,
          contrast,
          hairColor,
          eyeColor,
        })
      : output.colorSeason;
  if (familyTemperature && seasonBase !== output.colorSeason) {
    console.warn("[vision] season family from measured colouring", {
      model: output.colorSeason,
      derived: seasonBase,
      undertone,
      lean,
      contrast,
      hueAngle: measured ? Math.round(measured.undertoneHueAngle * 10) / 10 : null,
      confidence: measured ? Number(measured.undertoneConfidence.toFixed(2)) : null,
    });
  }
  const colorSeason = refineSeasonFromSkinHex({
    season: refineSeasonForClarity({
      season: seasonBase,
      undertone,
      clarity: output.clarity,
    }),
    undertone,
    skinHex: trust.useForSeason ? measuredSkinHex : undefined,
  });

  return {
    version: "1.0",
    demographics: {
      age: intake.age,
      genderPresentation: intake.genderPresentation,
      city: intake.city,
      country: intake.country,
      climate: climateFor(intake.country),
    },
    physical: {
      skinTone: output.skinTone,
      undertone,
      contrast,
      faceShape: output.faceShape,
      // Self-report / measurements take precedence over the vision estimate.
      bodyType:
        intake.bodyType ??
        inferBodyTypeFromMeasurements(
          intake.measurements,
          intake.genderPresentation,
        ) ??
        output.bodyType,
      heightCm: intake.heightCm,
      weightKg: intake.weightKg,
      measurements: intake.measurements,
      hairColor,
      eyeColor,
      skinHex,
      hairHex,
      eyeHex,
      lighting: output.lighting,
      ...(hexesCorrected ? { hexesCorrected: true } : {}),
      ...(measured
        ? {
            measured: {
              undertone: measured.undertone,
              undertoneHueAngle: Math.round(measured.undertoneHueAngle * 10) / 10,
              undertoneConfidence: Math.round(measured.undertoneConfidence * 100) / 100,
              contrastSpread:
                measured.contrastSpread == null
                  ? null
                  : Math.round(measured.contrastSpread * 100) / 100,
              castStrength: Math.round(measured.cast.strength * 100) / 100,
              castDirection: measured.castDirection,
              bodySkinUsed: measured.bodySkinUsed,
              ...(measured.bodySkinSkipped ? { bodySkinSkipped: measured.bodySkinSkipped } : {}),
              modelUndertone: output.undertone,
              modelContrast: output.contrast,
              samples: measured.skinSamples.map((s) => ({
                region: s.region,
                image: s.image,
                hex: rgbToHex(s.corrected),
              })),
              rejected: measured.rejected.map((r) => ({
                region: r.region,
                image: r.image,
                hex: r.hex,
                reason: r.reason,
              })),
            },
          }
        : {}),
    },
    colorSeason,
    colorSubseason: classifySubseason({
      season: colorSeason,
      undertone,
      contrast,
      clarity: output.clarity,
      hairColor,
      eyeColor,
    }),
    currency: intake.currency,
    goals: intake.goals,
    lifestyle: intake.lifestyle ?? [],
    occupation: intake.occupation,
    boldness: intake.boldness,
    budgetEur: intake.budgetEur,
  };
}

/** Cosine floor for a retrieved style rule to count as grounding. */
const RULE_MIN_SIMILARITY = 0.55;

/** Step 2 — RAG retrieval of grounding style rules from the knowledge base. */
export async function retrieveRules(profile: StyleProfile): Promise<string[]> {
  if (!hasAI || !hasSupabaseAdmin) return [];
  try {
    const query =
      `${profile.colorSeason} season, ${profile.physical.undertone} undertone, ` +
      `${profile.physical.contrast} contrast, ${profile.physical.faceShape} face, ` +
      `${profile.physical.bodyType} body, goals: ${profile.goals.join(", ")}`;
    const { embedding } = await embed({ model: env.embedModel, value: query });
    const sb = createAdminSupabase();
    const { data } = await sb.rpc("match_style_rules", {
      query_embedding: embedding,
      match_count: 8,
    });
    // Top-k without a floor lets unrelated rules into the grounding block on a
    // sparse knowledge base; keep only genuinely close matches.
    return ((data ?? []) as { content: string; similarity?: number }[])
      .filter((r) => r.similarity == null || r.similarity >= RULE_MIN_SIMILARITY)
      .map((r) => r.content);
  } catch {
    return [];
  }
}

/** Human-readable girth summary for the reasoning prompt (empty when absent). */
function measurementsSummary(m?: {
  shoulderCm?: number;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  sleeveCm?: number;
}): string {
  if (!m) return "";
  const parts = [
    m.shoulderCm && `shoulders ${m.shoulderCm}cm`,
    m.chestCm && `chest ${m.chestCm}cm`,
    m.waistCm && `waist ${m.waistCm}cm`,
    m.hipCm && `hips ${m.hipCm}cm`,
    m.sleeveCm && `sleeve ${m.sleeveCm}cm`,
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/**
 * Deterministic best/avoid palette for a profile — same colouring always yields
 * the same palette, so two reports from one photo can't show different colours.
 * The reasoning model still writes the rest of the report; only the palette is
 * pinned. Uses the stored subseason, or classifies one from the profile signals.
 */
function deterministicColors(profile: StyleProfile): ReportContent["colors"] {
  const undertone = profile.physical.undertone;
  const contrast = profile.physical.contrast;
  const subseason =
    profile.colorSubseason ??
    classifySubseason({
      season: profile.colorSeason,
      undertone,
      contrast,
      hairColor: profile.physical.hairColor,
      eyeColor: profile.physical.eyeColor,
    });
  // Add near-face depth guidance (safe deep tone for everyone; a bolder accent
  // for bold-leaning clients) so the palette copy tells the client what to wear
  // closest to the face — the axis that drives face-to-garment contrast.
  return annotateNearFaceGuidance(
    reportPalette({
      subseason,
      ...palettePersonWithTrust({
        undertone,
        contrast,
        hairColor: profile.physical.hairColor,
        eyeColor: profile.physical.eyeColor,
        skinTone: profile.physical.skinTone,
        skinHex: profile.physical.skinHex,
        hairHex: profile.physical.hairHex,
        eyeHex: profile.physical.eyeHex,
        lighting: lightingForTrust(profile.physical),
      }),
    }),
    {
      boldness: profile.boldness,
      goals: profile.goals,
      lifestyle: profile.lifestyle,
    },
  );
}

/**
 * Snap a model-produced look palette onto the report's deterministic BEST
 * colours (nearest RGB), so the generated look image renders in the exact
 * colours Carlo recommends — not the model's own, possibly off-season, picks.
 * Without this the swatch section (pinned) and the look images (free-form) drift
 * apart: a light-summer report can show warm-tan / charcoal outfits.
 */
function snapPaletteToBest(
  palette: string[],
  best: ReportContent["colors"]["best"],
): string[] {
  const swatches = best
    .map((c) => c.hex)
    .filter((h): h is string => typeof h === "string")
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .filter((h) => /^#[0-9a-fA-F]{6}$/.test(h));
  if (!swatches.length) return palette;
  const toRgb = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const swRgb = swatches.map((h) => [h, toRgb(h)] as const);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of palette) {
    if (typeof raw !== "string") continue;
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) continue;
    const t = toRgb(hex);
    let pick = swRgb[0]![0];
    let bestD = Infinity;
    for (const [sw, rgb] of swRgb) {
      const d =
        (rgb[0] - t[0]) ** 2 + (rgb[1] - t[1]) ** 2 + (rgb[2] - t[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        pick = sw;
      }
    }
    if (!seen.has(pick)) {
      seen.add(pick);
      out.push(pick);
    }
  }
  // Top up to at least 3 swatches so the palette line / chips stay meaningful.
  for (const sw of swatches) {
    if (out.length >= 3) break;
    if (!seen.has(sw)) {
      seen.add(sw);
      out.push(sw);
    }
  }
  return out.length ? out : swatches.slice(0, 4);
}

/** Step 3 — Explainable report content grounded in the retrieved rules. */
export async function recommend(
  intake: Intake,
  profile: StyleProfile,
  rules: string[],
  /** How many looks to produce (see `lookCountForTier`). */
  lookCount = lookCountForTier("basic"),
  tier: Tier = "basic",
): Promise<ReportContent> {
  // Always generated in ENGLISH: every downstream parser (garment vocabulary,
  // colour cues, occasion filters) and the image prompts are English. Non-English
  // reports translate the narrative AFTER catalogue matching (reports.ts).
  if (!hasAI) {
    return { ...mockReportContent(intake), colors: deterministicColors(profile) };
  }

  const hairRecommend = hairRecommendGenLimit(tier);
  const hairAvoid = HAIR_AVOID_GEN_LIMIT;

  // Pin the palette up front so the looks — and the images generated from them —
  // are built from the exact colours the report recommends, not the model's own.
  const colors = deterministicColors(profile);
  const bestPaletteText = colors.best
    .map((c) => `${c.name} ${c.hex}`)
    .join(", ");
  const avoidPaletteText = colors.avoid.map((c) => c.name).join(", ");

  // Deterministic occasion plan + per-look colour recipes — the same set-level
  // engineering the Create-a-Look path already has (hero / bottom / shoe
  // rotation, value schemes), so report looks cannot converge on one outfit.
  const plan = planReportLookContexts(profile, intake, lookCount);
  const recipes = lookSetColorRecipes(colors.best, plan.length, {
    boldness: intake.boldness,
    // Per-look occasions: weekend / travel looks may wear a light sneaker under
    // dark chinos; every other context keeps shoes no lighter than the trousers.
    occasionIds: plan.map((c) => c.id),
  });
  const planBlock = plan
    .map((ctx, i) => {
      const recipe = recipes[i];
      const occasionId = ctx.id;
      return (
        `Look ${i + 1} — context: "${ctx.context}". Occasion brief: ${ctx.brief}\n` +
        (recipe
          ? formatLookColorRecipePrompt(recipe, {
              boldness: intake.boldness,
              occasionId,
            })
          : "")
      );
    })
    .join("\n");

  const looksLine =
    lookCount <= 1
      ? `- Provide exactly 1 versatile look for everyday wear, with a ` +
        `3–4 colour hex palette and a one-line description of the outfit. ` +
        `Use exactly this "context" string: "${plan[0]?.context ?? "Smart casual"}".\n`
      : `- Provide exactly ${lookCount} looks, one per planned context below, IN THIS ORDER, ` +
        `using each planned context string verbatim as the look's "context". Each look has a ` +
        `3–4 colour hex palette and a one-line description of the outfit.\n` +
        `- Each look description MUST list every garment with its colour, comma-separated ` +
        `(e.g. "Powder-blue crewneck knit, grey-blue chinos, soft-denim loafers"). Use concrete catalogue words ` +
        `(blazer, overshirt, crewneck, chinos, trousers, loafers, sneakers) — not vague phrases like ` +
        `"textured layers" or "warm accents". ${LOOK_WEARABLE_RULE}\n` +
        `- Variety across the set: no two looks share the same top-garment type AND the same hero colour; ` +
        `no two looks share the same shoe colour; vary the jacket type (blazer / overshirt / knit-only / coat).\n` +
        `- Planned contexts and MANDATORY colour recipes (the recipe colours override the generic palette list for that look):\n${planBlock}\n`;

  // Structured slots — the machine-readable mirror of the description that
  // catalogue matching consumes directly (no prose re-parsing for new looks).
  const itemsLine =
    `- For EVERY look also fill "items": one entry per garment named in the ` +
    `description, in the same order. "garment" is the concrete catalogue noun ` +
    `exactly as worn (crewneck knit, chinos, loafers, belt, tote bag); "color" is ` +
    `the exact colour word(s) that garment carries in the description (null when ` +
    `uncoloured). The items list and the description MUST name the same garments ` +
    `and the same colours — never a garment in one but not the other.\n`;

  const grounding = rules.length
    ? `Ground every recommendation in these established style rules:\n- ${rules.join("\n- ")}\n`
    : "";

  // The palette is deterministic and pinned below — do not make the model
  // write ~14 colour entries with reasons that are thrown away.
  const generationSchema = reportContentSchema.omit({ colors: true });
  const { output: generated } = await generateText({
    model: env.modelReasoning,
    output: Output.object({ schema: generationSchema }),
    prompt:
      `You are a thoughtful, experienced personal stylist writing a calm, practical, non-judgmental report.\n\n` +
      `Style Profile (JSON):\n${JSON.stringify(profile)}\n\n` +
      `Occupation: ${intake.occupation}. Goals: ${intake.goals.join(", ")}. ` +
      (intake.lifestyle?.length
        ? `Lifestyle: ${intake.lifestyle.join(", ")}. `
        : "") +
      `Boldness: ${intake.boldness}. Budget: €${intake.budgetEur.min}–${intake.budgetEur.max}. ` +
      `City climate: ${profile.demographics.climate}.\n` +
      `Body type: ${profile.physical.bodyType}${measurementsSummary(profile.physical.measurements)}.\n\n` +
      `${grounding}\n` +
      `Produce an explainable style report. Requirements:\n` +
      `- The colour palette (best AND avoid) is supplied and fixed — the LOOKS must obey it.\n` +
      `- CRITICAL — colours: every look's "palette" hex codes AND every garment colour ` +
      `named in its "description" MUST be drawn ONLY from the client's BEST colours: ` +
      `${bestPaletteText}. Do not introduce colours outside this set — in particular no ` +
      `black, no charcoal, and no warm tan/camel/brown/olive/rust unless it literally appears ` +
      `above. Never use the AVOID colours (${avoidPaletteText}) for garments. ` +
      `Exception — dress codes beat colour analysis: classic black or dark-brown dress shoes, ` +
      `belts and a matching briefcase are business etiquette, so a work or formal look MAY name ` +
      `them; in doList/dontList phrase black as "avoid black near the face / as a garment", ` +
      `never as a flat ban on black shoes.\n` +
      `- Colour placement by occasion (the looks follow these rules, so the summary and doList must not ` +
      `promise otherwise): mauve / rose / pink / blush / lilac / lavender lead at most ONE look, and only ` +
      `a weekend or smart-casual one — never a work, business-social or dinner look, so do not promise ` +
      `"a mauve blazer" or "a rose knit" for those; white / pearl / ivory / cream trousers belong to weekend, ` +
      `smart-casual and travel looks, never work, business social or dinner.\n` +
      `- For hair: exactly ${hairRecommend} recommended hairstyles and exactly ${hairAvoid} styles to avoid, ` +
      `each with a concrete reason tied to face shape (${profile.physical.faceShape}).\n` +
      `- Tailor the silhouette "fit" line and all 3 rules specifically to the "${profile.physical.bodyType}" body type: ` +
      `what to emphasise, what to balance, and which cuts/proportions to avoid for this shape. Reference the body type explicitly.\n` +
      `- Ensure the looks flatter this body type.\n` +
      looksLine +
      itemsLine +
      `- doList and dontList: 4 short, actionable items each.\n` +
      `Keep the tone refined and encouraging. Write in English.`,
  });

  // Pin the palette to the deterministic, subseason-curated set so identical
  // colouring always produces identical colours.
  const output: ReportContent = { ...generated, colors };
  // Snap each look's palette onto the best colours so the generated look IMAGE
  // (which is prompted with look.palette) can't drift off-season even if the
  // model ignored the colour instruction above.
  output.looks = (output.looks ?? []).map((l, i) => {
    const occasionId = lookOccasionIdFromContext(l.context) ?? plan[i]?.id ?? null;
    let description = sanitizeLookDescription(
      l.description ?? "",
      occasionId,
      intake.boldness,
    );
    let items = l.items;
    // Work / formal looks wear the recipe's dress leather — the model's greige
    // oxfords under charcoal trousers are snapped back to it (no retry budget
    // for a whole-report call).
    const recipe = recipes[i];
    if (recipe) {
      const fixed = enforceRecipeJacketColour(
        enforceRecipeBelt(
          enforceRecipeShoe({ description, items }, recipe, occasionId),
          recipe,
        ),
        recipe,
        occasionId,
        intake.boldness,
      );
      description = fixed.description ?? description;
      items = fixed.items ?? undefined;
    }
    return {
      ...l,
      description,
      // Keep the structured slots in step with the sanitised prose — items
      // must never resurrect a prop/pocket-square the description dropped.
      items: sanitizeLookItems(items, description, occasionId),
      palette: snapPaletteToBest(l.palette ?? [], colors.best),
    };
  });
  return output;
}

/**
 * Generate a single standalone look for an existing report — the "one more
 * look" add-on. Grounded in the Style Profile and a chosen occasion brief, with
 * an optional one-line user note. Falls back to a deterministic look (derived
 * from the mock report) when AI is unavailable. `existingTitles` are avoided so
 * each purchased look is distinct from the ones already on the report.
 */
export async function generateExtraLook(opts: {
  intake: Intake;
  profile: StyleProfile;
  context: string;
  brief: string;
  note?: string;
  rules?: string[];
  existingTitles?: string[];
  /** Per-request strictness override — shapes the TEXT brief only (never the image prompt). */
  boldness?: Boldness;
  /** Per-request season override — shapes the TEXT brief only (never the image prompt). */
  season?: LookBriefSeason;
  /** Occasion id — party × statement gets a stronger after-dark brief. */
  occasionId?: string;
  /** Slot in the set (0-based) — rotates party jacket fabric and work silhouettes. */
  lookIndex?: number;
  /** Set size — 6 and 9 looks get a wider variety brief than 3. */
  looksCount?: number;
  /** Aesthetic preset (Riviera, Nordic, …) — shapes the TEXT brief only. */
  styleId?: string;
  /** Set-slot colour recipe — pins this look's hero/bottom/neutrals. */
  colorRecipe?: LookColorRecipe;
}): Promise<{
  context: string;
  title: string;
  description: string;
  palette: string[];
  /** Structured garment slots (machine-readable mirror of `description`). */
  items?: LookItem[];
}> {
  const {
    intake,
    profile,
    context,
    brief,
    note,
    rules,
    existingTitles,
    boldness,
    season,
    occasionId,
    lookIndex,
    looksCount,
    styleId,
    colorRecipe,
  } = opts;

  if (!hasAI) {
    const mock = mockReportContent(intake);
    const used = new Set((existingTitles ?? []).map((t) => t.toLowerCase()));
    const pick =
      mock.looks.find((l) => !used.has(l.title.toLowerCase())) ?? mock.looks[0]!;
    return {
      ...pick,
      context,
      ...(colorRecipe ? { palette: recipePaletteHexes(colorRecipe) } : {}),
    };
  }

  // Weave season + strictness into the brief text only — the look IMAGE prompt
  // (generateLookImage) is untouched by design; see look-brief.ts.
  const effectiveBrief = withWearableLookRule(
    composeLookBrief(brief, {
      boldness,
      season,
      occasionId,
      lookIndex,
      looksCount,
      styleId,
    }),
  );

  const grounding = rules?.length
    ? `Ground the look in these established style rules:\n- ${rules.join("\n- ")}\n`
    : "";
  const avoid = existingTitles?.length
    ? `Avoid repeating these existing looks (make this one clearly different in title and outfit): ${existingTitles.join("; ")}.\n`
    : "";
  const noteLine = note?.trim()
    ? `User request for this specific look: "${note.trim()}". Honour it within the occasion and the profile.\n`
    : "";

  const colors = deterministicColors(profile);
  const bestPaletteText = colors.best.map((c) => `${c.name} ${c.hex}`).join(", ");
  const avoidPaletteText = colors.avoid.map((c) => c.name).join(", ");

  const lookPrompt = (extra = "") =>
    `You are a thoughtful personal stylist creating ONE additional outfit for an existing client report.\n\n` +
    `Style Profile (JSON):\n${JSON.stringify(profile)}\n\n` +
    `Occupation: ${intake.occupation}. Goals: ${intake.goals.join(", ")}. ` +
    (intake.lifestyle?.length
      ? `Lifestyle: ${intake.lifestyle.join(", ")}. `
      : "") +
    `Boldness: ${intake.boldness}. Budget: €${intake.budgetEur.min}–${intake.budgetEur.max}. ` +
    `City climate: ${profile.demographics.climate}.\n` +
    `Body type: ${profile.physical.bodyType}${measurementsSummary(profile.physical.measurements)}.\n\n` +
    `Occasion: ${context}. Styling brief: ${effectiveBrief}\n` +
    noteLine +
    extra +
    avoid +
    grounding +
    `Produce exactly ONE look:\n` +
    `- context: "${context}".\n` +
    `- title: a short evocative name (2–4 words).\n` +
    `- description: ONE line naming each garment with its colour, comma-separated ` +
      `— concrete catalogue words only. ${LOOK_WEARABLE_RULE}\n` +
    `- items: one entry per garment named in the description, in the same order — ` +
      `"garment" is the concrete catalogue noun exactly as worn, "color" is the exact ` +
      `colour word(s) from the description (null when uncoloured). The items list and ` +
      `the description MUST name the same garments and the same colours.\n` +
    (colorRecipe
      ? formatLookColorRecipePrompt(colorRecipe, { boldness, occasionId })
      : `- CRITICAL — colours: the "palette" hex codes AND every garment colour in the ` +
        `"description" MUST be drawn ONLY from the client's BEST colours: ${bestPaletteText}. ` +
        `No black/charcoal and no warm tan/camel/brown/olive/rust unless it appears above. ` +
        `Never use the AVOID colours (${avoidPaletteText}) for garments — classic black or ` +
        `dark-brown dress shoes and belt are business etiquette and MAY be named for a work ` +
        `or formal occasion.\n`) +
    // English only — matching parsers and image prompts are English; the
    // look-extra route translates title/description for display afterwards.
    `Keep the tone refined and practical. Write in English.`;

  const runLook = (prompt: string) =>
    generateText({
      model: env.modelReasoning,
      output: Output.object({ schema: lookContentSchema }),
      prompt,
    });

  let { output } = await runLook(lookPrompt());
  if (
    occasionId === "party" &&
    boldness === "statement" &&
    lookIndex != null &&
    !lookStyleHasBrief(styleId) &&
    !partyJacketMatchesSlot(output.description ?? "", lookIndex)
  ) {
    ({ output } = await runLook(
      lookPrompt(
        "RETRY: this look MUST include a blazer or sport coat in the jacket fabric specified above — not a shirt-only silhouette.\n",
      ),
    ));
  }
  // Dinner slots 0 and 1 carry a jacket-class layer; a knit-and-chinos daytime
  // read is exactly what the set must not be.
  if (
    occasionId === "dinner" &&
    lookIndex != null &&
    (looksCount ?? 0) >= 2 &&
    !lookStyleHasBrief(styleId) &&
    !dinnerLayerMatchesSlot(output.description ?? "", lookIndex)
  ) {
    ({ output } = await runLook(
      lookPrompt(
        "RETRY: this look MUST include the evening layer specified above (blazer, sport coat, overshirt or chore jacket) — not a knit-only or shirt-only silhouette.\n",
      ),
    ));
  }
  // The recipe hero is the set's variety mechanism — if the model dropped it,
  // two looks end up wearing the same teal jumper.
  if (colorRecipe && !recipeHeroHonoured(output, colorRecipe)) {
    ({ output } = await runLook(
      lookPrompt(
        `RETRY: the hero colour ${colorRecipe.hero.name} (${colorRecipe.hero.hex}) MUST be the main top / near-face garment, named in both the description and the items.\n`,
      ),
    ));
  }

  // Work / formal shoes are dress leather by etiquette. The recipe asked for a
  // dark pair; if the model still named greige oxfords, retry once, then snap
  // the shoe (and its belt) to the recipe deterministically.
  if (colorRecipe && !recipeShoeHonoured(output, colorRecipe, occasionId)) {
    ({ output } = await runLook(
      lookPrompt(
        `RETRY: for this occasion the shoes MUST be ${colorRecipe.shoe.name} (${colorRecipe.shoe.hex}) dress leather, with the belt in the same leather — never greige, stone, dove-grey or any shoe lighter than the trousers.\n`,
      ),
    ));
    output = enforceRecipeShoe(output, colorRecipe, occasionId);
  }
  // The belt is leather, never a colour: a spruce belt under spruce loafers is
  // the model ignoring the recipe's belt line.
  if (colorRecipe) output = enforceRecipeBelt(output, colorRecipe);
  if (colorRecipe)
    output = enforceRecipeJacketColour(
      output,
      colorRecipe,
      occasionId,
      boldness ?? intake.boldness,
    );

  // Guarantee the returned palette is on-report even if the model drifted; the
  // look image is prompted from this palette. A set recipe wins over the model.
  const palette = snapPaletteToBest(
    colorRecipe ? recipePaletteHexes(colorRecipe) : (output.palette ?? []),
    colors.best,
  );
  const description = sanitizeLookDescription(
    output.description ?? "",
    occasionId,
    boldness ?? intake.boldness,
  );
  return {
    ...output,
    description,
    items: sanitizeLookItems(output.items, description, occasionId),
    palette,
    context,
  };
}

const carloNoteSchema = z.object({ note: z.string() });

/**
 * One short Carlo-voice closing note summarising a just-generated "look set"
 * (several outfit directions for one occasion, Create-a-Look). Returns the
 * text stored on `look_sets.carlo_note`. Best-effort in spirit — callers
 * should treat a thrown error as non-fatal to the set — but this function
 * itself does not swallow errors; falls back to a deterministic sentence
 * when AI is unavailable rather than calling the model.
 */
export async function carloNoteForSet(opts: {
  profile: StyleProfile;
  occasionLabel: string;
  looks: { title: string }[];
}): Promise<string> {
  const { profile, occasionLabel, looks } = opts;
  const titles = looks.map((l) => l.title.trim()).filter(Boolean);

  if (!hasAI) {
    return titles.length
      ? `A set of ${titles.length} looks for ${occasionLabel}, each built from your palette ` +
          `and profile — pick whichever fits the moment, they all hold together as a set.`
      : `A set of looks for ${occasionLabel}, each built from your palette and profile.`;
  }

  const { output } = await generateText({
    model: env.modelReasoning,
    output: Output.object({ schema: carloNoteSchema }),
    prompt:
      `You are Carlo Valetti, a calm, precise personal stylist, writing a short closing note ` +
      `for a client who just received a set of looks for "${occasionLabel}".\n\n` +
      `Style Profile (JSON):\n${JSON.stringify(profile)}\n\n` +
      `The set contains these looks:\n- ${titles.join("\n- ")}\n\n` +
      `Write ONE short note in your voice, 2–3 sentences, calm and encouraging, no hype words. ` +
      `Tie it to the client's colouring/profile and the occasion, and note how the looks work ` +
      `together as a set (e.g. shared palette, versatility across the occasion). Do not list ` +
      `the look titles verbatim — refer to the set as a whole. Write in English.`,
  });

  return output.note.trim();
}

/**
 * Catalogue product photos are often lifestyle shots — a whole suit on a model
 * for "trousers", a flat-lay in a stand-in colour for a "similar" knit. Scope
 * what the image model may take from each one, or it copies the model's jacket
 * and top and paints the customer in the photo's colour.
 */
function catalogImageScopeNote(g: {
  category: string;
  similarPick?: boolean;
  lookColour?: string | null;
}): string {
  const cat = (g.category || "garment").toLowerCase();
  return (
    `Take ONLY the ${cat} from this photo — ignore any other garment, the model's ` +
    `body and face, and the background in it. ` +
    (g.similarPick && g.lookColour
      ? `Use it for garment type and texture only; the ${cat} is ${g.lookColour} — ` +
        `the look's colour, not the photo's. `
      : "")
  );
}

/**
 * Step 4 — Generate a photorealistic look image. If a reference portrait URL is
 * provided, the image model preserves the person's identity (image-to-image).
 * Returns raw bytes (PNG/JPEG) or null on failure / demo mode.
 */
export async function generateLookImage(opts: {
  profile: StyleProfile;
  look: {
    title: string;
    description: string;
    palette: string[];
    /** Catalogue pieces from “Shop a look like this” (dominates the prompt). */
    catalogContext?: string;
    /** Public product image URLs rendered as garment references. */
    catalogImageUrls?: string[];
    /** Same photos with titles so each input image can be bound to a garment. */
    catalogImages?: {
      url: string;
      title: string;
      category: string;
      similarPick?: boolean;
      lookColour?: string | null;
    }[];
    /** Explicit footwear directive (e.g. dress shoes only, no sandals). */
    footwearRule?: string;
  };
  referenceImageUrl?: string;
  /** Portrait anchor for identity when a separate full-length photo is also provided. */
  faceReferenceImageUrl?: string;
  /** Optional side/three-quarter portrait — extra face-geometry anchor only. */
  profileReferenceImageUrl?: string;
  /** Pre-rendered outfit photo (e.g. capsule combo) — clothing reference only. */
  outfitReferenceImageUrl?: string;
  /**
   * Camera for a companion 3/4 render. Default stays front-facing (unchanged).
   * When `three_quarter`, pass the current front look as `outfitReferenceImageUrl`
   * so garments stay locked and only the angle changes.
   */
  view?: "front" | "three_quarter";
  /** Deep palette hex to place on the garment nearest the face (contrast/definition). */
  nearFaceHex?: string;
  /** EXPERIMENTAL — per-run prompt-version override (else `IMAGE_PROMPT_VERSION`). */
  promptVersion?: string | number | null;
  /** Work / formal default the shirt hem tucked in. */
  occasionId?: string | null;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const {
      profile,
      look,
      referenceImageUrl,
      faceReferenceImageUrl,
      profileReferenceImageUrl,
      outfitReferenceImageUrl,
      nearFaceHex,
    } = opts;
    const view = opts.view ?? "front";
    const isThreeQuarter = view === "three_quarter";
    const catalogImages = (
      look.catalogImages?.length
        ? look.catalogImages.filter((i) => i.url)
        : (look.catalogImageUrls ?? [])
            .filter(Boolean)
            .map((url) => ({ url, title: "", category: "" }))
    ).filter((i) => i.url);
    const catalogImageUrls = catalogImages.map((i) => i.url);
    const hasCatalog = Boolean(look.catalogContext) || catalogImageUrls.length > 0;
    const hasOutfitRef = Boolean(outfitReferenceImageUrl);
    const hasFace = Boolean(faceReferenceImageUrl);
    const hasProfile = Boolean(profileReferenceImageUrl);
    const hasFull = Boolean(referenceImageUrl);
    const faceImageCount = (hasFace ? 1 : 0) + (hasProfile ? 1 : 0);
    const personImageCount = faceImageCount + (hasFull ? 1 : 0);
    const wearableDescription = sanitizeLookDescription(
      look.description,
      opts.occasionId,
      opts.profile.boldness,
    );
    // Catalogue SKUs own materials and colours. The look caption used to leak
    // "suede derbies" / "teal poplin" into these directives and beat the shop.
    // Always include the sanitised description so a stored "crewneck + tie"
    // is rewritten to a V-neck before the tie/layering directives run.
    const directiveSource = hasCatalog
      ? [
          look.catalogContext,
          catalogImages.map((i) => i.title).join(", "),
          wearableDescription,
        ]
          .filter(Boolean)
          .join(" ")
      : wearableDescription;
    const eyewearBlock = eyewearPromptDirective(directiveSource);
    const tuckBlock = tuckPromptDirective(
      `${look.description} ${directiveSource}`,
      opts.occasionId,
    );
    const tieBlock = tiePromptDirective(directiveSource);
    const hatBlock = hatPromptDirective(directiveSource);
    const sneakerBlock = sneakerPromptDirective(directiveSource);
    const backpackBlock = backpackPromptDirective(directiveSource);
    const fabricBlock = fabricPromptDirective(directiveSource);
    const blazerTypeBlock = blazerTypePromptDirective(directiveSource);
    const shoeMaterialBlock = shoeMaterialPromptDirective(directiveSource);
    const ordinals = [
      "FIRST",
      "SECOND",
      "THIRD",
      "FOURTH",
      "FIFTH",
      "SIXTH",
      "SEVENTH",
      "EIGHTH",
      "NINTH",
      "TENTH",
      "ELEVENTH",
      "TWELFTH",
    ];
    const ordinal = (n: number) => ordinals[n - 1] ?? `${n}TH`;

    const subject =
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      bodyTypeSubjectClause(profile.physical.bodyType) +
      `Soft natural light, neutral studio backdrop, ` +
      `confident relaxed pose, sharp focus, magazine quality. ` +
      `Vertical 9:16 framing, full body head to shoes visible. ` +
      (isThreeQuarter
        ? `CRITICAL camera: three-quarter view — the body is turned 30 to 45 degrees from the camera, not front-on and not a full profile. Most of the face stays visible. Same studio, lighting and distance as a front look. `
        : "");

    // When catalogue picks exist, THEY define the outfit. The free-text look
    // description is demoted to a styling/mood hint so it stops dominating and
    // re-creating the report's original look.
    const namesSquare = /\b(pocket[\s-]?squares?|pochettes?|handkerchiefs?)\b/i.test(
      `${wearableDescription} ${look.catalogContext ?? ""}`,
    );
    const emptyTrouserPockets =
      `Trouser pockets stay empty and lie flat — no cloth peeking out. `;
    const squarePlacement = namesSquare
      ? `The pocket square sits in the jacket breast pocket only. `
      : "";
    const outfitBlock = hasCatalog
      ? `${look.catalogContext ?? ""}` +
        `Styling note: keep city-work formality and proportions. Do not add garments ` +
        `or swap the catalogue shirt, trousers, shoes or bag for pieces named only ` +
        `in a look caption. ` +
        squarePlacement +
        emptyTrouserPockets
      : `Outfit: ${wearableDescription}. ` + squarePlacement + emptyTrouserPockets;

    // The image model tends to default to sandals for warm palettes; an explicit
    // footwear directive with a hard negative keeps formal looks in dress shoes.
    const footwearBlock = look.footwearRule ? `${look.footwearRule} ` : "";

    // Correct menswear layering order. The near-face colour directive (below) can
    // otherwise nudge the model into nonsensical stacking — e.g. an open button-up
    // shirt WORN OVER a jumper. Just as important: forbid ADDING a layer that was
    // not listed (the model likes to slip a stray knit under a blazer), which is
    // exactly the "grey jumper under every blazer" artefact.
    const layeringRule =
      `Render ONLY the garments listed above — do not add any layer that is not ` +
      `listed (no extra jumper, knit, waistcoat or shirt) — with two exceptions: the ` +
      `person is always fully dressed, so if no top garment is listed at all, wear one ` +
      `plain neutral top; never shirtless, never a bare chest. And if a blazer, sport ` +
      `coat, jacket or coat is listed without a shirt, polo or knit (a knit blazer is a ` +
      `jacket, not a knit worn alone), wear a plain collared shirt under it — never open ` +
      `a jacket on a bare chest. A jumper, crewneck or polo may be worn on ` +
      `its own with a bare neckline — only show a shirt under a knit if a shirt is ` +
      `listed; never add an unlisted shirt beneath a knit. When BOTH a knit and a ` +
      `shirt are listed, the knit is worn OVER the shirt (a long-sleeve knit over a ` +
      `long-sleeve shirt so the collar and cuffs peek out), never a button-up shirt ` +
      `on top of a knit — EXCEPT a roll-neck / turtleneck, which is never worn with ` +
      `a collared shirt (no collar peeking out of, or sitting on top of, the roll-neck; ` +
      `the roll-neck replaces the shirt). A blazer, overshirt or coat is always the outermost layer. ` +
      `If sunglasses or glasses are listed, they are worn ON the face over the eyes — ` +
      `never held in a hand, tucked in a pocket, hanging from a shirt, or pushed up on the forehead. Match the ` +
      `named frame exactly: sunglasses may be round, wayfarer, aviator, rectangular, geometric, oval, or wraparound sport; ` +
      `optical glasses may be round, rectangular, oval, geometric, or rimless (lenses mounted directly to the bridge and temples, no surrounding frame). ` +
      `When sunglasses are described as mirrored, the lenses are a reflective mirror finish, not a flat dark tint. ` +
      `Hands stay empty unless a tote, backpack, briefcase or messenger bag is listed — ` +
      `never hold a wallet, cardholder, phone, keys or any other small prop. ` +
      `Trouser pockets stay empty and lie flat. ` +
      `A listed backpack is held in one hand or slung on one shoulder — never worn ` +
      `on both shoulders. ` +
      `If a shirt, oxford, tee, polo or henley is tucked in, the hem sits inside the trouser waistband; if worn untucked, the hem hangs over the trousers. ` +
      `A necktie is never worn on top of a jumper or knit — it sits on the shirt ` +
      `under the knit (V-neck or open cardigan) or between jacket lapels. ` +
      `Trousers described as "suit", "tailored", "dress" trousers or chinos are ` +
      `smooth woven wool or cotton cloth — NEVER blue or washed denim / jeans, even ` +
      `if the item name contains the word "washed". `;

    // Describe the role of each input image so identity (person photos) and the
    // garments (catalogue product photos) are not confused. Images are attached
    // in this exact order below: face portrait, profile portrait, full-length,
    // outfit, catalogue — so we assign ordinals with a running counter.
    let imageRoles = "";
    let imgIdx = 0;
    if (hasFace) {
      imgIdx += 1;
      imageRoles +=
        `The ${ordinal(imgIdx)} image is a close-up front portrait — match this person's ` +
        `face, hair and identity exactly. `;
    }
    if (hasProfile) {
      imgIdx += 1;
      imageRoles +=
        `The ${ordinal(imgIdx)} image is a side / three-quarter portrait of the SAME person ` +
        `at a different angle — use it ONLY to refine facial geometry (nose shape, jawline, ` +
        `cheekbones, eye spacing). Do not copy its pose, lighting, background or clothing. ` +
        (hasFace
          ? `Both portraits are the same person from the same period; if they disagree, the ` +
            `front portrait wins. `
          : `Preserve this person's face, hair and identity exactly. `);
    }
    if (hasFull) {
      imgIdx += 1;
      imageRoles +=
        (faceImageCount > 0
          ? `The ${ordinal(imgIdx)} image is a full-length photo of the same person — this is the ` +
            `AUTHORITATIVE body. Copy this exact shoulder-to-hip ratio, waist, torso length, ` +
            `arm and leg thickness and posture. Do not athleticise, add a V-taper, or take ` +
            `physique from any catalogue model. Use this photo for body and pose only. `
          : `The ${ordinal(imgIdx)} image shows the person — preserve their face, hair and ` +
            `identity exactly. `) +
        // The selfie's clothes must not leak into the render (a flat-lay knit
        // loses to the shirt the customer wore) — but "ignore the clothing"
        // read as "undress": say REPLACE, and pin that the person stays dressed.
        `Do not carry the clothing from this photo into the result — it is REPLACED, ` +
        `garment for garment, by the outfit${hasCatalog ? " and catalogue images" : ""} ` +
        `below. The person stays fully dressed: a top over the torso, bottoms and shoes ` +
        `— never shirtless, never a bare chest. `;
    }
    if (hasOutfitRef) {
      imgIdx += 1;
      imageRoles += isThreeQuarter
        ? `The ${ordinal(imgIdx)} image is this SAME look photographed from the front — keep this exact person and every garment, colour, fabric, fit and accessory identical. Do not redesign the clothes or change the styling. Only rotate the camera to a 30–45° three-quarter angle. `
        : `The ${ordinal(imgIdx)} image shows the exact outfit to dress them in — copy only the clothing, ` +
          `colours and proportions; do not copy the model's face or body. `;
    }
    if (catalogImages.length) {
      const catalogStart = imgIdx + 1;
      imgIdx += catalogImages.length;
      if (catalogImages.length === 1) {
        const only = catalogImages[0];
        imageRoles += only.title
          ? `The ${ordinal(catalogStart)} image is the ${only.category.toLowerCase()} to wear: ${only.title} — reproduce this exact piece. ` +
            catalogImageScopeNote(only)
          : `The ${ordinal(catalogStart)} image is the actual catalogue garment to dress them in — ` +
            `reproduce that exact garment on the person. `;
      } else {
        catalogImages.forEach((g, i) => {
          const n = catalogStart + i;
          imageRoles += g.title
            ? `The ${ordinal(n)} image is the ${g.category.toLowerCase()} to wear: ${g.title} — reproduce this exact piece. ` +
              catalogImageScopeNote(g)
            : `The ${ordinal(n)} image is a catalogue garment reference — reproduce that exact garment on the person. `;
        });
      }
      // When garment product photos share the prompt with the person's photos,
      // the model tends to blend faces from the product shots and lose likeness.
      // Make identity fidelity to the portrait override the garment references.
      if (personImageCount > 0) {
        imageRoles +=
          `CRITICAL identity and body rule: the person's face, bone structure, skin tone, hair ` +
          `AND body proportions come ONLY from ${faceImageCount > 0 ? "the portrait photo(s) and the full-length photo" : "the person photo"} — ` +
          `reproduce them at maximum fidelity. Keep their ${profile.physical.bodyType} build from the full-length photo` +
          (profile.physical.heightCm && profile.physical.weightKg
            ? ` (${profile.physical.heightCm}cm, ${profile.physical.weightKg}kg)`
            : "") +
          `. ` +
          `The catalogue images are clothing swatches only: copy the garments, and take NOTHING ` +
          `facial, bodily or pose-related from them — never the catalogue model's shoulders, ` +
          `waist, chest, legs or V-taper. `;
      }
    }
    // Full-length, profile, outfit and swatches all follow the first face.
    // Re-attach the close-up last so identity is the final visual token —
    // same lock looks, cover and capsule already get when catalogue shots exist.
    const reattachFace = shouldReattachFacePortrait(hasFace, imgIdx - (hasFace ? 1 : 0));
    if (reattachFace) {
      imgIdx += 1;
      imageRoles += faceReattachRole(ordinal(imgIdx));
    }

    // Text anchor for the face. The model regenerates the whole scene, so a
    // reference photo alone can drift; these explicit traits + "do not alter"
    // rules keep the rendered face true to the real person.
    let faceAnchor = "";
    if (personImageCount > 0) {
      const traits = [
        profile.physical.faceShape
          ? `${profile.physical.faceShape} face shape`
          : null,
        profile.physical.hairColor ? `${profile.physical.hairColor} hair` : null,
        profile.physical.eyeColor ? `${profile.physical.eyeColor} eyes` : null,
        profile.physical.skinTone
          ? `${profile.physical.skinTone} skin tone`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
      const skinRule = skinTonePreservationRule(profile);
      faceAnchor =
        (traits ? `The person has ${traits}. ` : "") +
        `Keep the SAME facial proportions as the reference photo — the same forehead ` +
        `height, nose size and shape, jawline, cheekbones, eye spacing and lip shape; ` +
        `do not idealise, slim or restyle the face. ` +
        skinRule +
        `Do NOT age the person — no added wrinkles, and do not make them look older or younger. ` +
        `Keep the EXACT hairstyle from the portrait — same colour, length, texture, ` +
        `volume, parting and hairline. Do not slick, wave, or restyle the hair into a ` +
        `fashion-model cut. ` +
        `Do NOT add or increase facial hair — no extra beard, stubble or moustache beyond ` +
        `what the reference photo shows. ` +
        `The result must be recognisably this same person, not a similar-looking model. ` +
        bodyTypeLock(profile.physical.bodyType, profile.physical) +
        eyewearBlock;
    }
    if (!personImageCount && !catalogImageUrls.length) {
      imageRoles = `Do not show identifiable facial features. `;
    } else if (!personImageCount && catalogImageUrls.length) {
      imageRoles =
        `The provided image(s) are the actual catalogue garments to render as the outfit. ` +
        `Do not show identifiable facial features. `;
    }

    // Near-face contrast: a mid-value tone that matches the skin's lightness
    // right under the chin flattens the face. A specific deep hex (nearFaceHex)
    // is forced on the anchor / statement looks; every other look still gets the
    // general principle so tops vary but never sit at skin-level lightness.
    const nearFacePrinciple =
      personImageCount > 0
        ? `Keep clear contrast between the face and the garment nearest it: avoid a ` +
          `pale or mid-value top that matches the skin's own lightness directly under ` +
          `the chin — use either a deeper or a distinctly crisper palette tone there. `
        : "";
    const nearFaceBlock = hasCatalog
      ? `Keep each catalogue garment's colour exactly as listed and shown in its ` +
        `product photo — do not deepen, teal-shift or recolour the shirt or shoes ` +
        `for face contrast or palette harmony. `
      : nearFaceHex
        ? `Near-face colour: the garment closest to the face (the top layer — knit, ` +
          `shirt, jacket or its collar) MUST be ${nearFaceHex} — a deliberate tone from ` +
          `the palette. If the outfit text names a lighter or mid-value top, deepen it to ` +
          `this tone; other garments keep their described colours. `
        : nearFacePrinciple;

    const preamble =
      `Editorial, full-length fashion photograph for a premium style report. `;
    const paletteLine = hasCatalog
      ? ""
      : `Colour palette: ${look.palette.join(", ")}. `;

    // v1 baseline — kept byte-identical so version 1 == the historical prompt.
    const legacyPrompt =
      preamble +
      outfitBlock +
      layeringRule +
      footwearBlock +
      paletteLine +
      nearFaceBlock +
      subject +
      imageRoles +
      faceAnchor +
      eyewearBlock +
      tuckBlock +
      tieBlock +
      hatBlock +
      sneakerBlock +
      backpackBlock +
      fabricBlock +
      blazerTypeBlock +
      shoeMaterialBlock +
      NO_TEXT_RULE;

    // EXPERIMENTAL prompt versioning (see look-prompt.ts). v2+ pull the hard
    // negatives out of the descriptive blocks into one trailing Constraints
    // group; `layeringOrder` is the positive-only remainder of `layeringRule`.
    const layeringOrder =
      `A jumper, crewneck or polo may be worn on its own with a bare neckline — only show a shirt ` +
      `under a knit if a shirt is listed. A knit blazer is a jacket and is never worn on bare skin. When both a knit and a shirt are worn, ` +
      `a long-sleeve knit goes OVER a long-sleeve shirt (only the shirt's collar ` +
      `and cuffs peek out); a roll-neck or turtleneck is never worn with a collared ` +
      `shirt — it replaces the shirt. A blazer, overshirt or coat is always the outermost ` +
      `layer. Sunglasses or glasses, when listed, sit on the face over the eyes ` +
      `in the named frame shape. Rimless glasses have no surrounding frame — the lenses attach directly to the bridge and temples. Mirrored sunglasses have reflective mirror lenses, not a flat dark tint. ` +
      `A shirt, oxford, tee, polo or henley described as tucked in has its hem inside the trouser waistband; if worn untucked, the hem hangs over the trousers. ` +
      `A necktie is never worn on top of a jumper — it sits on the shirt under a V-neck knit or open cardigan. `;
    const constraints = [
      `render EXACTLY the garments listed — do not add any layer that is not ` +
        `listed (no extra jumper, knit, waistcoat or shirt); exceptions: ` +
        `the person is always fully dressed — if no top is listed at all, wear one plain ` +
        `neutral top, never shirtless; if a blazer, jacket or coat is listed without a ` +
        `shirt, polo or knit, wear a plain collared shirt under it — never a jacket on a bare chest`,
      `the person is fully clothed head to toe — a top over the torso, trousers, shoes; ` +
        `never a bare chest`,
      `trousers described as "suit", "tailored" or "dress" trousers, or chinos, ` +
        `are smooth woven wool or cotton — never blue or washed denim / jeans, ` +
        `even if the item name contains the word "washed"`,
      `no text, letters, words, captions, labels, headings, watermarks, logos, ` +
        `numbers, arrows or graphic overlays anywhere in the frame`,
      `sunglasses or glasses listed in the outfit are worn on the face over the ` +
        `eyes in the named frame shape — not held, not in a pocket, not hanging from clothing, not on the forehead`,
      `hands stay empty unless a listed tote, backpack, briefcase or messenger is carried — no wallet, cardholder, phone or other handheld prop`,
      `trouser pockets stay empty and lie flat — no cloth peeking out`,
      `a listed backpack is held in one hand or slung on one shoulder — never worn on both shoulders`,
      `keep the client's ${profile.physical.bodyType} build from the full-length photo — never copy a catalogue model's athletic V-taper, shoulders or waist`,
    ];
    if (eyewearBlock) {
      constraints.push(
        `listed eyewear is mandatory on the face — never render a bare face if sunglasses, glasses or goggles appear in the outfit`,
      );
    }
    if (tuckBlock) {
      constraints.push(tuckBlock.trim());
    }
    if (tieBlock) {
      constraints.push(tieBlock.trim());
    }
    if (hatBlock) {
      constraints.push(hatBlock.trim());
    }
    if (sneakerBlock) {
      constraints.push(sneakerBlock.trim());
    }
    if (backpackBlock) {
      constraints.push(backpackBlock.trim());
    }
    if (fabricBlock) {
      constraints.push(fabricBlock.trim());
    }
    if (blazerTypeBlock) {
      constraints.push(blazerTypeBlock.trim());
    }
    if (shoeMaterialBlock) {
      constraints.push(shoeMaterialBlock.trim());
    }
    if (hasCatalog) {
      constraints.push(
        `catalogue titles and photos win — do not use a look-caption shirt colour or shoe finish`,
      );
    }
    if (isThreeQuarter) {
      constraints.push(
        `three-quarter camera only — do not redesign garments; keep the front-look clothes identical and only change the angle`,
      );
    }
    const promptParts: LookPromptParts = {
      legacyPrompt,
      preamble,
      subject,
      outfitBlock,
      footwearBlock,
      paletteLine,
      nearFaceBlock,
      imageRoles,
      faceAnchor,
      layeringOrder,
      constraints,
    };
    const promptVersion = resolveImagePromptVersion(opts.promptVersion);
    const prompt = buildLookImagePrompt(promptParts, promptVersion);

    const content: (
      | { type: "text"; text: string }
      | { type: "image"; image: URL }
    )[] = [{ type: "text", text: prompt }];
    if (faceReferenceImageUrl) {
      content.push({ type: "image", image: new URL(faceReferenceImageUrl) });
    }
    if (profileReferenceImageUrl) {
      try {
        content.push({ type: "image", image: new URL(profileReferenceImageUrl) });
      } catch {
        // Skip a malformed profile URL rather than failing the whole render.
      }
    }
    if (referenceImageUrl) {
      content.push({ type: "image", image: new URL(referenceImageUrl) });
    }
    if (outfitReferenceImageUrl) {
      try {
        content.push({
          type: "image",
          image: new URL(outfitReferenceImageUrl),
        });
      } catch {
        // Skip malformed outfit reference URLs.
      }
    }
    for (const url of catalogImageUrls) {
      try {
        content.push({ type: "image", image: new URL(url) });
      } catch {
        // Skip malformed product URLs rather than failing the whole render.
      }
    }
    if (reattachFace && faceReferenceImageUrl) {
      content.push({ type: "image", image: new URL(faceReferenceImageUrl) });
    }

    return await renderImage(content);
  } catch (err) {
    console.error("[generateLookImage] render failed", err);
    return null;
  }
}

/**
 * Generate a bespoke "magazine cover" photo for the report PDF cover — a single
 * full-length editorial hero shot of the person, styled in their palette, with
 * clean negative space for the masthead. Generated once at report time.
 */
export async function generateCoverImage(opts: {
  profile: StyleProfile;
  palette?: string[];
  archetype?: string;
  referenceImageUrl?: string;
  /** Close-up portrait anchor for identity when a full-length photo is also provided. */
  faceReferenceImageUrl?: string;
  /** Optional side/three-quarter portrait — extra face-geometry anchor only. */
  profileReferenceImageUrl?: string;
  /** Deep palette hex to place on the garment nearest the face (contrast/definition). */
  nearFaceHex?: string;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const {
      profile,
      referenceImageUrl,
      faceReferenceImageUrl,
      profileReferenceImageUrl,
      nearFaceHex,
    } = opts;
    const palette = (opts.palette ?? []).filter(Boolean);

    const hasFace = Boolean(faceReferenceImageUrl);
    const hasProfile = Boolean(profileReferenceImageUrl);
    const hasFull = Boolean(referenceImageUrl);
    const hasPerson = hasFace || hasProfile || hasFull;

    // Explain the role of each input image so the model takes the face from the
    // close-up portrait(s) (many pixels, reliable likeness) and body/pose from the
    // full-length shot — the face is tiny on a full-length frame and drifts if
    // used alone. Images are attached below in this exact order: front portrait,
    // profile portrait, full-length.
    let imageRoles = "";
    let imgIdx = 0;
    if (hasFace) {
      imgIdx += 1;
      imageRoles +=
        `The ${imgIdx === 1 ? "FIRST" : "SECOND"} image is a close-up front portrait — ` +
        `match this person's face, hair and identity exactly. `;
    }
    if (hasProfile) {
      imgIdx += 1;
      const ord = imgIdx === 1 ? "FIRST" : imgIdx === 2 ? "SECOND" : "THIRD";
      imageRoles +=
        `The ${ord} image is a side / three-quarter portrait of the SAME person — use it ` +
        `ONLY to refine facial geometry (nose, jawline, cheekbones); do not copy its pose, ` +
        `lighting, background or clothing. ` +
        (hasFace
          ? `Both portraits are the same person; if they disagree, the front portrait wins. `
          : `Preserve this person's face, hair and identity exactly. `);
    }
    if (hasFull) {
      imgIdx += 1;
      const ord = imgIdx === 1 ? "FIRST" : imgIdx === 2 ? "SECOND" : "THIRD";
      imageRoles +=
        hasFace || hasProfile
          ? `The ${ord} image is a full-length photo of the same person — this is the ` +
            `AUTHORITATIVE body. Copy this exact shoulder-to-hip ratio, waist and posture. ` +
            `Do not athleticise or take physique from a fashion model. Use only for body proportions. `
          : `The ${ord} image is a photo of the person — preserve their face, hair, skin tone ` +
            `and identity exactly; this is that same person. `;
    }
    const coverOrdinals = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"];
    const reattachCoverFace = shouldReattachFacePortrait(
      hasFace,
      imgIdx - (hasFace ? 1 : 0),
    );
    if (reattachCoverFace) {
      imgIdx += 1;
      imageRoles += faceReattachRole(coverOrdinals[imgIdx - 1] ?? `${imgIdx}TH`);
    }

    // Text anchor for the face. The cover regenerates the whole scene, so a
    // reference photo alone can drift; these explicit traits + "do not alter"
    // rules keep the rendered face true to the real person (mirrors the look
    // renderer, which produces noticeably better likeness).
    let faceAnchor = "";
    if (hasPerson) {
      const traits = [
        profile.physical.faceShape
          ? `${profile.physical.faceShape} face shape`
          : null,
        profile.physical.hairColor ? `${profile.physical.hairColor} hair` : null,
        profile.physical.eyeColor ? `${profile.physical.eyeColor} eyes` : null,
        profile.physical.skinTone
          ? `${profile.physical.skinTone} skin tone`
          : null,
      ]
        .filter(Boolean)
        .join(", ");
      faceAnchor =
        (traits ? `The person has ${traits}. ` : "") +
        `Keep the SAME facial proportions as the reference photo — the same forehead ` +
        `height, nose size and shape, jawline, cheekbones, eye spacing and lip shape; ` +
        `do not idealise, slim or restyle the face. ` +
        skinTonePreservationRule(profile) +
        `Do NOT age the person — no added wrinkles, and do not make them look older or younger. ` +
        `Do NOT change the hair colour. ` +
        `Do NOT add or increase facial hair — no extra beard, stubble or moustache beyond ` +
        `what the reference photo shows. Render the face at maximum fidelity to the portrait. ` +
        bodyTypeLock(profile.physical.bodyType, profile.physical);
    }

    const prompt =
      `Cover photograph for a luxury men's style magazine — a single full-length ` +
      `editorial hero shot in a bright, airy, high-key style. ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      bodyTypeSubjectClause(profile.physical.bodyType) +
      `dressed in refined, well-tailored clothing` +
      (palette.length ? ` in a ${palette.join(", ")} colour palette. ` : ". ") +
      (nearFaceHex
        ? `Put a DEEP tone from the palette on the garment closest to the face ` +
          `(the top layer or its collar), around ${nearFaceHex}, so the face reads ` +
          `with strong contrast — avoid a pale or mid-value tone under the chin. `
        : "") +
      (opts.archetype ? `Overall mood: ${opts.archetype}. ` : "") +
      `Composition: the subject stands full-length slightly to the RIGHT of centre, ` +
      `weight relaxed, one hand in a trouser pocket, calm confident expression. ` +
      `The LEFT third of the frame is clean, empty, softly-lit wall — deliberate negative ` +
      `space for cover text. Leave generous empty space ABOVE the head (for a masthead) ` +
      `and a clear band along the BOTTOM (for a title). ` +
      `Background: a minimalist warm-neutral studio — smooth plaster / travertine wall in ` +
      `soft beige, gentle natural daylight from the side, low soft shadows, no props. ` +
      `Bright and evenly lit so dark text overlays read cleanly on the empty areas. ` +
      `Vertical cover framing (taller than wide), head-to-shoes fully visible, sharp focus, ` +
      `high-end retouching, editorial magazine-cover quality. ` +
      imageRoles +
      faceAnchor +
      (hasPerson ? "" : `Do not show identifiable facial features. `) +
      NO_TEXT_RULE;

    const content: (
      | { type: "text"; text: string }
      | { type: "image"; image: URL }
    )[] = [{ type: "text", text: prompt }];
    if (faceReferenceImageUrl) {
      content.push({ type: "image", image: new URL(faceReferenceImageUrl) });
    }
    if (profileReferenceImageUrl) {
      try {
        content.push({ type: "image", image: new URL(profileReferenceImageUrl) });
      } catch {
        // Skip a malformed profile URL rather than failing the whole render.
      }
    }
    if (referenceImageUrl) {
      content.push({ type: "image", image: new URL(referenceImageUrl) });
    }
    if (reattachCoverFace && faceReferenceImageUrl) {
      content.push({ type: "image", image: new URL(faceReferenceImageUrl) });
    }

    return await renderImage(content);
  } catch {
    return null;
  }
}

/**
 * One editorial flat-lay showing the report's recommended watch variants (case
 * × dial × strap) — no brands, no text. Generated once per premium/lookbook
 * report so the watch section has a visual, without a per-watch image cost.
 */
export async function generateWatchBoardImage(opts: {
  palette?: string[];
  variants: {
    context: string;
    type: string;
    shape?: string;
    caseMetal: string;
    dial: string;
    strap: string;
  }[];
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI || !opts.variants.length) return null;
  try {
    const palette = (opts.palette ?? []).filter(Boolean);
    const lines = opts.variants.map(
      (v, i) =>
        `${i + 1}. ${v.type} (${v.context}), ${v.shape ?? "round"} case: ` +
        `${v.caseMetal} case, ${v.dial} dial, ${v.strap} strap.`,
    );
    const prompt =
      `A clean, top-down editorial flat-lay product photograph of ${opts.variants.length} ` +
      `distinct men's wristwatches arranged in a neat row on a soft warm-neutral surface ` +
      `(smooth plaster / fine linen), gentle daylight, soft shadows, high-end catalogue ` +
      `quality, sharp focus. Each watch is a DIFFERENT type / style, described below — make ` +
      `their design language clearly distinct (a dress watch, a field/pilot/dive/sport or ` +
      `smartwatch, etc. as specified):\n${lines.join("\n")}\n` +
      `Case shapes: prefer round cases unless a variant is explicitly rectangular or square. ` +
      `Render generic, unbranded watches — NO brand names, NO logos, NO numerals or text ` +
      `of any kind on the dials, cases, straps or background. ` +
      (palette.length ? `Overall colour harmony: ${palette.join(", ")}. ` : "") +
      `The watches must clearly differ in type, case metal, dial colour and strap as described. ` +
      NO_TEXT_RULE;

    return await renderImage([{ type: "text", text: prompt }]);
  } catch {
    return null;
  }
}

/**
 * One editorial flat-lay of the report's footwear system (3–4 shoe roles) —
 * no brands, no text. Generated once per premium/lookbook report so the
 * footwear section has a visual, without a per-shoe image cost.
 */
export async function generateShoeBoardImage(opts: {
  palette?: string[];
  variants: {
    role: string;
    style: string;
    color: string;
    colorHex?: string;
    finish?: string;
  }[];
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI || !opts.variants.length) return null;
  try {
    const lines = opts.variants.map((v, i) => {
      const hex = v.colorHex?.trim() ? ` (${v.colorHex.trim()})` : "";
      // Explicit finish so the smooth-vs-suede contrast is rendered, not guessed.
      const finish = v.finish?.trim() ? ` in ${v.finish.trim()}` : "";
      return `${i + 1}. ${v.style} (${v.role})${finish} — leather/material colour MUST be ${v.color}${hex}.`;
    });
    // Only forbid black when none of the recommended variants are black —
    // deep winters (etc.) may legitimately recommend black dress shoes.
    const recommendsBlack = opts.variants.some((v) =>
      /\bblack\b/i.test(v.color),
    );
    const colourFidelity =
      `Each pair's colour is FIXED by the list above — render exactly that leather/material ` +
      `colour (use the hex when given). Do NOT invent shoe colours and do NOT tint the shoes ` +
      `with any surrounding or wardrobe palette. ` +
      (recommendsBlack
        ? ""
        : `None of these shoes are black — do NOT default dress oxfords/derbies to pure black ` +
          `or near-black. `);

    // NOTE: intentionally do NOT pass the client's wardrobe palette here — it is
    // the colour of their CLOTHES, and feeding it into a shoes-only flat-lay makes
    // the model tint the shoes with those tones. Shoe colours are set per pair.
    const prompt =
      `A clean, editorial product-photography sheet of ${opts.variants.length} pairs of men's ` +
      `shoes on a plain, neutral off-white / greige surface (smooth plaster or fine linen), ` +
      `gentle daylight, soft shadows, high-end catalogue quality, sharp focus. Tall / portrait ` +
      `composition. Lay it out as a grid of EXACTLY ${opts.variants.length} rows and EXACTLY 2 ` +
      `columns (${opts.variants.length}×2) — total ${opts.variants.length * 2} shoe photographs, ` +
      `one pair per row:\n` +
      `  • LEFT column = view (a): the pair standing upright on its soles, toes pointing toward ` +
      `the bottom of the frame (front three-quarter view);\n` +
      `  • RIGHT column = view (b): a clean side profile of the SAME pair.\n` +
      `Each pair appears on exactly ONE row and nowhere else. Do NOT duplicate, repeat or add ` +
      `extra columns/copies of any pair — only two images per pair (front + side). Use these exact ` +
      `same two angles for every row and keep the two views of a pair identical in style and ` +
      `colour. Each pair is a DIFFERENT style AND colour, described below:\n` +
      `${lines.join("\n")}\n` +
      colourFidelity +
      `Formal-shoe rule: any oxfords or derbies MUST be a classic formal leather ` +
      `(black, dark brown or burgundy) exactly as named above — NEVER navy, blue, slate ` +
      `or any coloured leather on an oxford/derby. Every OTHER pair must be rendered in ` +
      `exactly the leather/material colour named for it above — those named colours are all ` +
      `realistic footwear leathers, so reproduce them faithfully (a named navy loafer stays navy, ` +
      `a named cognac moccasin stays cognac). Regardless of the names, never render ANY shoe in a ` +
      `novelty or non-leather colour — no pink, coral, peach, lilac, lavender, mint, lime, yellow, ` +
      `turquoise, cyan or neon / fluorescent tones anywhere in the sheet. ` +
      `Trainer-sole rule: any trainer / sneaker with a coloured upper must have a clean ` +
      `CONTRASTING midsole and outsole — white, cream, gum or pale grey — not a fully ` +
      `monochrome shoe where the sole matches the upper, UNLESS the whole trainer is ` +
      `white / off-white or black (where a tonal sole is natural). ` +
      `Render generic, unbranded shoes — NO brand names, NO logos, NO text of any kind on ` +
      `the shoes, soles or background. Classic, refined menswear silhouettes. ` +
      `The pairs must clearly differ in style and colour exactly as described. ` +
      NO_TEXT_RULE;

    return await renderImage([{ type: "text", text: prompt }]);
  } catch {
    return null;
  }
}

export type CatalogTryOnGarment = {
  title: string;
  category: string;
  /** Hex or text colour; placeholder "#CCCCCC" is ignored. */
  color?: string | null;
  /** Absolute image URL (already normalized by the caller). */
  imageUrl?: string | null;
};

/**
 * Catalog try-on via the image model (same pipeline as look renders): dress
 * the person from their own full-length photo in up to 6 exact catalogue garments,
 * preserving identity, pose, background and lighting, with correct layering
 * (outerwear over a base layer — never on bare skin).
 */
export async function generateCatalogTryOnImage(opts: {
  personImageUrl: string;
  garments: CatalogTryOnGarment[];
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI || !opts.garments.length) return null;
  try {
    const garments = pickTryOnGarments(opts.garments, MAX_TRYON_GARMENTS);
    const garmentImages = garments
      .filter(
        (g): g is CatalogTryOnGarment & { imageUrl: string } =>
          Boolean(g.imageUrl && /^https?:\/\//i.test(g.imageUrl)),
      )
      .map((g) => ({
        url: upgradeCatalogImageUrl(g.imageUrl),
        title: g.title,
        category: g.category,
      }));

    const prompt =
      `Photorealistic virtual try-on. ` +
      `The FIRST image is the customer's own full-length photo. Recreate this exact ` +
      `photograph changing ONLY the clothing listed below. Preserve the person's ` +
      `identity perfectly: same face and expression, same hairstyle, same skin tone, ` +
      `same body shape and proportions, same pose and hand positions, same background, ` +
      `same camera angle, perspective and lighting. ` +
      (garmentImages.length
        ? garmentImages
            .map((g, i) => {
              const n = i + 2;
              return `Image ${n} is the ${g.category.toLowerCase()} to wear: ${g.title} — reproduce this exact piece. `;
            })
            .join("")
        : ``) +
      catalogTryOnGarmentsText(garments) +
      `Layering rules — follow strictly: outerwear (jackets, blazers, coats, ` +
      `overshirts, cardigans) is always worn OVER a base layer, never directly on ` +
      `bare skin; if the original photo already shows a suitable top underneath, keep ` +
      `it visible at the collar and hem; otherwise add a simple neutral base layer ` +
      `that suits the outfit. A new top replaces only the current top layer; new ` +
      `trousers or a skirt replace only the current bottoms; new shoes replace only ` +
      `the shoes. Every garment NOT being replaced must remain exactly as in the ` +
      `original photo. ` +
      `Reproduce each catalogue garment faithfully — exact colour, fabric texture, ` +
      `pattern, buttons, zips, stitching, fit and proportions — with natural drape, ` +
      `realistic folds, and shadows consistent with the original photo's light. ` +
      `The result must look like an unedited photograph of the same person in the ` +
      `same place, now wearing the new pieces. Full body, head to shoes visible.` +
      NO_TEXT_RULE;

    const content: (
      | { type: "text"; text: string }
      | { type: "image"; image: URL }
    )[] = [
      { type: "text", text: prompt },
      { type: "image", image: new URL(opts.personImageUrl) },
    ];
    for (const g of garmentImages) {
      try {
        content.push({ type: "image", image: new URL(g.url) });
      } catch {
        // Skip malformed product URLs rather than failing the whole render.
      }
    }

    return await renderImage(content);
  } catch (e) {
    console.error("[tryon] image-pipeline render failed", e);
    return null;
  }
}

/**
 * Report "try it on me" — CONSERVATIVE studio variant (recreate-in-place).
 *
 * The alternative to `generateLookImage` for report try-on: instead of rendering
 * a fresh editorial scene (which re-synthesises and drifts the face), this edits
 * the customer's OWN full-length photo. It copies the face, skin tone, hair and
 * pose verbatim and swaps only the clothing, replacing just the background with a
 * neutral studio backdrop under soft, even light consistent with the subject. The
 * face is never relit/recoloured, so identity holds as well as the catalogue
 * try-on. Selectable per-render (`style: "studio"`); the editorial path and the
 * catalogue / Shop-a-look flows are unchanged.
 */
export async function generateReportTryOnImage(opts: {
  /** The customer's own full-length photo — the base to recreate. */
  personImageUrl: string;
  /** Garment instruction block (catalogue prompt or an "Outfit: …" fallback). */
  garmentsText: string;
  /** Optional catalogue product image URLs to reproduce exact garments. */
  garmentImageUrls?: string[];
  /** Same photos with titles so each input image can be bound to a garment. */
  garmentImages?: {
    url: string;
    title: string;
    category: string;
    similarPick?: boolean;
    lookColour?: string | null;
  }[];
  /** Work / formal default the shirt hem tucked in. */
  occasionId?: string | null;
  /** Party × statement may keep a plum velvet jacket. */
  boldness?: string | null;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const garmentImages = (
      opts.garmentImages?.length
        ? opts.garmentImages.filter((i) => i.url)
        : (opts.garmentImageUrls ?? []).map((url) => ({
            url,
            title: "",
            category: "",
          }))
    ).filter((i) => i.url && /^https?:\/\//i.test(i.url))
      .map((i) => ({ ...i, url: upgradeCatalogImageUrl(i.url) }));
    const refs = pickTryOnGarments(
      garmentImages.map((g) => ({
        ...g,
        category: g.category || "Clothing",
      })),
      MAX_TRYON_GARMENTS,
    );
    const garmentImageUrls = refs.map((i) => i.url);
    const garmentsText = sanitizeLookDescription(
      opts.garmentsText,
      opts.occasionId,
      opts.boldness,
    );
    const eyewearBlock = eyewearPromptDirective(garmentsText);
    const tuckBlock = tuckPromptDirective(garmentsText, opts.occasionId);
    const tieBlock = tiePromptDirective(garmentsText);
    const hatBlock = hatPromptDirective(garmentsText);
    const sneakerBlock = sneakerPromptDirective(garmentsText);
    const backpackBlock = backpackPromptDirective(garmentsText);
    const fabricBlock = fabricPromptDirective(garmentsText);
    const blazerTypeBlock = blazerTypePromptDirective(garmentsText);
    const shoeMaterialBlock = shoeMaterialPromptDirective(garmentsText);

    const prompt =
      `Photorealistic virtual try-on for a style report. ` +
      `The FIRST image is the customer's own full-length photo. Recreate this ` +
      `photograph of the SAME person, changing only their CLOTHING and the ` +
      `BACKGROUND. The customer's own clothes are REPLACED, garment for garment, ` +
      `by the list and catalogue images below — but the person stays fully dressed: ` +
      `a top over the torso, bottoms and shoes; if the list names no top, wear one ` +
      `plain neutral top. Never shirtless, never a bare chest. ` +
      `Preserve identity perfectly: same face and expression, same facial features ` +
      `and proportions, same hairstyle and hair colour, same eye colour, same skin ` +
      `tone, same body shape, same pose and hand positions. Do NOT relight, ` +
      `recolour, slim, age or restyle the face — copy the face, hair and skin tone ` +
      `EXACTLY as in the photo, keeping the same light on the face. ` +
      eyewearBlock +
      `Replace the background with a clean, seamless neutral studio backdrop ` +
      `(pale grey / greige) under soft, even, flattering studio light that is ` +
      `consistent with the subject — but keep the light on the person's face ` +
      `consistent with the original photo so their features and skin tone are ` +
      `unchanged. ` +
      `Output a vertical 9:16 frame, full body head to shoes visible, with the ` +
      `person standing in the same pose. If the source photo is wider or shorter, ` +
      `extend the studio wall above the head and below the feet so the canvas ` +
      `fills 9:16 — continue the same backdrop with natural light falloff and ` +
      `subtle wall texture. Do NOT letterbox, pillarbox, or pad the image with ` +
      `flat solid-colour bars. ` +
      (refs.length
        ? refs
            .map((g, i) => {
              const n = i + 2;
              return g.title
                ? `Image ${n} is the ${g.category.toLowerCase()} to wear: ${g.title} — reproduce this exact piece. ` +
                  catalogImageScopeNote(g)
                : `Image ${n} is a catalogue garment — reproduce this exact product. `;
            })
            .join("")
        : ``) +
      garmentsText +
      `Layering — follow strictly: outerwear (jackets, blazers, coats, overshirts, ` +
      `cardigans) is always worn OVER a base layer, never on bare skin. A knit blazer is ` +
      `a jacket, not a knit worn alone. The torso is ` +
      `never bare — a listed top, or a plain neutral one when none is listed. A jumper, crewneck or polo may ` +
      `be worn on its own; only show a shirt under a knit if a shirt is listed, and ` +
      `then a long-sleeve knit goes OVER a long-sleeve shirt (collar and cuffs peek ` +
      `out), never a shirt over a knit. A necktie is never worn on top of a jumper — ` +
      `it sits on the shirt under a V-neck knit or open cardigan. A roll-neck or turtleneck is never worn with ` +
      `a collared shirt — no collar peeking out of or sitting on the roll-neck; the ` +
      `roll-neck replaces the shirt. If sunglasses or glasses are listed, they are ` +
      `worn ON the face over the eyes — never held in a hand, in a pocket, hanging ` +
      `from a shirt, or pushed onto the forehead — in the named frame shape. Rimless glasses ` +
      `have lenses mounted directly to the bridge and temples with no surrounding frame. ` +
      `Mirrored sunglasses have reflective mirror lenses, not a flat dark tint. ` +
      `If a shirt, oxford, tee, polo or henley is tucked in, the hem sits inside the trouser waistband; if worn untucked, the hem hangs over the trousers. ` +
      `Trousers described as "suit", "tailored" or ` +
      `"dress" trousers or chinos are smooth woven wool or cotton — never blue or ` +
      `washed denim, even if the item name contains "washed". ` +
      `Reproduce each garment faithfully — exact colour, fabric texture, pattern, ` +
      `buttons, zips, stitching, fit and proportions — with natural drape and ` +
      `realistic shadows. The result must look like a real photograph of the SAME ` +
      `      person, same face, now wearing the new outfit against a clean studio ` +
      `backdrop.` +
      eyewearBlock +
      tuckBlock +
      tieBlock +
      hatBlock +
      sneakerBlock +
      backpackBlock +
      fabricBlock +
      blazerTypeBlock +
      shoeMaterialBlock +
      NO_TEXT_RULE;

    const content: (
      | { type: "text"; text: string }
      | { type: "image"; image: URL }
    )[] = [
      { type: "text", text: prompt },
      { type: "image", image: new URL(opts.personImageUrl) },
    ];
    for (const url of garmentImageUrls) {
      try {
        content.push({ type: "image", image: new URL(url) });
      } catch {
        // Skip malformed product URLs rather than failing the whole render.
      }
    }

    return await renderImage(content);
  } catch (e) {
    console.error("[tryon] studio try-on render failed", e);
    return null;
  }
}

/**
 * Generate a personalized hairstyle headshot. With a reference portrait, the
 * model preserves the person's identity while applying the named cut.
 */
/**
 * Headshot renders inherit whatever the client wore in the reference selfie —
 * a red tartan hoodie ends up on six pages of a Soft Summer report. Dress the
 * subject in a plain, deep on-palette crewneck instead when a swatch is known.
 */
function portraitOutfitRule(outfit?: { name: string; hex: string } | null): string {
  if (!outfit) return "";
  return (
    `Dress the subject in a plain ${outfit.name.toLowerCase()} (${outfit.hex}) crewneck knit ` +
    `or fine-gauge sweater — clean, unbranded, no pattern, no hood, no logos — so the top ` +
    `frames the face in the client's own palette. `
  );
}

export async function generateHairImage(opts: {
  profile: StyleProfile;
  hair: { name: string; why: string };
  recommend: boolean;
  referenceImageUrl?: string;
  angle?: "front" | "profile" | "three_quarter";
  /** Deep BEST-palette swatch for the plain top the subject wears. */
  outfit?: { name: string; hex: string } | null;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const { profile, hair, recommend, referenceImageUrl } = opts;
    const angle = opts.angle ?? "front";
    const intent = recommend
      ? `Render the person wearing this hairstyle in a flattering way: ${hair.name}.`
      : `Render the person wearing this hairstyle: ${hair.name}.`;

    const angleNote =
      angle === "front"
        ? "Face the camera directly, front-facing headshot."
        : angle === "profile"
          ? "Head turned to a side profile (90°), showing the hairstyle silhouette from the side."
          : "Head turned roughly 45° (three-quarter view), showing the hairstyle from the side while keeping most of the face visible.";

    const prompt =
      `Editorial beauty headshot for a premium grooming report. ` +
      HEADSHOT_FRAMING +
      `Hairstyle: ${hair.name}. ${intent} ` +
      `Camera angle: ${angleNote} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on hair and face, magazine quality, tasteful and respectful. ` +
      portraitOutfitRule(opts.outfit) +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — change only the hairstyle` +
          (opts.outfit ? ` and the top garment.` : `.`)
        : `Do not show identifiable facial features.`) +
      NO_TEXT_RULE;

    const content = referenceImageUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: new URL(referenceImageUrl) },
        ]
      : [{ type: "text" as const, text: prompt }];

    return await renderImage(content);
  } catch {
    return null;
  }
}

/**
 * Generate a personalized facial-hair preview (beard / mustache). With a
 * reference portrait, the model preserves identity while applying the style.
 */
export async function generateFacialHairImage(opts: {
  profile: StyleProfile;
  style: { name: string; why: string };
  referenceImageUrl?: string;
  /** Deep BEST-palette swatch for the plain top the subject wears. */
  outfit?: { name: string; hex: string } | null;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const { profile, style, referenceImageUrl } = opts;
    const prompt =
      `Editorial grooming headshot for a premium style report. ` +
      HEADSHOT_FRAMING +
      `Facial hair style: ${style.name}. ${style.why} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on face and facial hair, magazine quality, tasteful and respectful. ` +
      portraitOutfitRule(opts.outfit) +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — change only the facial hair style` +
          (opts.outfit ? ` and the top garment.` : `.`)
        : `Do not show identifiable facial features.`) +
      NO_TEXT_RULE;

    const content = referenceImageUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: new URL(referenceImageUrl) },
        ]
      : [{ type: "text" as const, text: prompt }];

    return await renderImage(content);
  } catch {
    return null;
  }
}

/**
 * Generate a personalized eyewear preview. With a reference portrait, the
 * model preserves identity while applying the named frame style.
 */
export async function generateEyewearImage(opts: {
  profile: StyleProfile;
  frame: { name: string; why: string; shape?: string; kind?: "optical" | "sun" };
  referenceImageUrl?: string;
  /** Deep BEST-palette swatch for the plain top the subject wears. */
  outfit?: { name: string; hex: string } | null;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const { profile, frame, referenceImageUrl } = opts;
    const isSun = frame.kind === "sun";
    const eyewearType = isSun
      ? `Fashion sunglasses with tinted lenses`
      : `Optical eyeglasses with clear lenses`;
    const prompt =
      `Editorial eyewear headshot for a premium style report. ` +
      HEADSHOT_FRAMING +
      `${eyewearType}: ${frame.name}${frame.shape ? ` (${frame.shape} shape)` : ""}. ${frame.why} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on face and ${isSun ? "sunglasses" : "glasses"}, magazine quality, tasteful and respectful. ` +
      portraitOutfitRule(opts.outfit) +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — change only the eyewear` +
          (opts.outfit ? ` and the top garment.` : `.`)
        : `Do not show identifiable facial features.`) +
      NO_TEXT_RULE;

    const content = referenceImageUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: new URL(referenceImageUrl) },
        ]
      : [{ type: "text" as const, text: prompt }];

    return await renderImage(content);
  } catch {
    return null;
  }
}

/**
 * Colour guidance so the piece AND the surrounding outfit sit in the client's
 * palette instead of whatever the image model defaults to. Deterministic from
 * undertone + season — keeps hats/scarves and their jackets on-palette.
 */
function outfitPaletteGuidance(
  profile: StyleProfile,
  paletteNames?: string[] | null,
): string {
  const u = (profile.physical.undertone ?? "").toLowerCase();
  const season = profile.colorSeason ? ` (${profile.colorSeason})` : "";
  const named = (paletteNames ?? []).filter(Boolean);
  if (named.length) {
    return (
      `Keep BOTH the piece and the outfit in the client's own palette${season}: ` +
      `${named.join(", ")} — co-ordinated so the colours harmonise; no colour outside that list.`
    );
  }
  if (u.includes("warm")) {
    return (
      `Keep BOTH the piece and the outfit in the client's warm palette${season}: ` +
      `warm neutrals such as camel, tobacco brown, olive, stone, cream and warm charcoal, ` +
      `co-ordinated so the colours harmonise. Avoid cool greys, icy blue and stark black.`
    );
  }
  if (u.includes("cool")) {
    return (
      `Keep BOTH the piece and the outfit in the client's cool palette${season}: ` +
      `cool neutrals such as charcoal, slate grey, navy and crisp white, ` +
      `co-ordinated so the colours harmonise. Avoid warm browns, camel and orange tones.`
    );
  }
  return (
    `Keep BOTH the piece and the outfit in the client's balanced neutral palette${season}: ` +
    `taupe, greige, soft brown, grey and off-white, co-ordinated and muted so the colours harmonise.`
  );
}

/**
 * Premium add-on: render an accessory (scarf / neckwear / tie) on the user's own
 * photo, preserving identity (image-to-image), shown shoulders-up so the
 * neckwear is clearly visible.
 */
export async function generateAccessoryImage(opts: {
  profile: StyleProfile;
  accessory: { name: string; why: string; kind?: "scarf" | "neckwear" | "tie" };
  referenceImageUrl?: string;
  /** BEST-palette names so the piece and outfit use the real palette, not a generic one. */
  paletteNames?: string[] | null;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const { profile, accessory, referenceImageUrl } = opts;
    const piece =
      accessory.kind === "tie"
        ? "a necktie knotted over a collared shirt under a jacket"
        : accessory.kind === "neckwear"
          ? "a neckerchief / silk neck-scarf knotted at an open collar"
          : "a scarf draped around the neck over a coat or knitwear";
    const prompt =
      `Editorial accessory styling photo for a premium style report. ` +
      HEADSHOT_FRAMING +
      `Accessory: ${accessory.name} — ${piece}. ${accessory.why} ` +
      `${outfitPaletteGuidance(profile, opts.paletteNames)} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}. ` +
      `Upper-body framing (head to mid-chest) so the neckwear is clearly visible, ` +
      `neutral soft studio backdrop, natural soft light, sharp focus, magazine quality, tasteful and respectful. ` +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only add the accessory and a simple on-palette outfit.`
        : `Do not show identifiable facial features.`) +
      NO_TEXT_RULE;

    const content = referenceImageUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: new URL(referenceImageUrl) },
        ]
      : [{ type: "text" as const, text: prompt }];

    return await renderImage(content);
  } catch {
    return null;
  }
}

/**
 * Render headwear (hat / cap / beanie / bandana) on the user's own photo,
 * preserving identity (image-to-image), framed so the full headwear and the top
 * of the head are visible.
 */
export async function generateHeadwearImage(opts: {
  profile: StyleProfile;
  headwear: {
    name: string;
    why: string;
    kind?: "hat" | "cap" | "beanie" | "bandana";
  };
  referenceImageUrl?: string;
  /** BEST-palette names so the piece and outfit use the real palette, not a generic one. */
  paletteNames?: string[] | null;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const { profile, headwear, referenceImageUrl } = opts;
    const piece =
      headwear.kind === "cap"
        ? "a baseball cap worn on the head"
        : headwear.kind === "beanie"
          ? "a knitted beanie worn on the head"
          : headwear.kind === "bandana"
            ? "a bandana worn on the head"
            : "a brimmed hat (fedora / felt hat) worn on the head";
    const prompt =
      `Editorial headwear styling photo for a premium style report. ` +
      HEADSHOT_FRAMING +
      `Headwear: ${headwear.name} — ${piece}. ${headwear.why} ` +
      `${outfitPaletteGuidance(profile, opts.paletteNames)} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. ` +
      `Frame so the full headwear and the top of the head are clearly visible (leave headroom above the hat), ` +
      `neutral soft studio backdrop, natural soft light, sharp focus on the face and headwear, magazine quality, tasteful and respectful. ` +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only add the headwear and a simple on-palette outfit.`
        : `Do not show identifiable facial features.`) +
      NO_TEXT_RULE;

    const content = referenceImageUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: new URL(referenceImageUrl) },
        ]
      : [{ type: "text" as const, text: prompt }];

    return await renderImage(content);
  } catch {
    return null;
  }
}

/** Full text/analysis pipeline (no images / catalogue yet). */
export async function generateReportContent(
  intake: Intake,
  photos: PhotoInput[],
  /** Number of looks to generate (see `lookCountForTier`). */
  lookCount = lookCountForTier("basic"),
  tier: Tier = "basic",
): Promise<{ profile: StyleProfile; content: ReportContent }> {
  const profile = await analyzeProfile(intake, photos);
  const rules = await retrieveRules(profile);
  const content = await recommend(intake, profile, rules, lookCount, tier);
  return { profile, content };
}
