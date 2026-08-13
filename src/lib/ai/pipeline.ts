import "server-only";
import { generateText, Output, embed } from "ai";
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
  type StyleProfile,
  type ReportContent,
  type Boldness,
} from "@/lib/style-profile";
import { composeLookBrief, type LookBriefSeason } from "@/lib/ai/look-brief";
import { languageInstruction, type ReportLanguage } from "@/lib/languages";
import {
  reportPalette,
  annotateNearFaceGuidance,
} from "@/lib/colour-palette";
// EXPERIMENTAL prompt versioning — see look-prompt.ts for how to remove.
import {
  buildLookImagePrompt,
  resolveImagePromptVersion,
  type LookPromptParts,
} from "@/lib/ai/look-prompt";
import { eyewearPromptDirective } from "@/lib/look-constructor";

export type PhotoInput = { role: string; url: string };

/**
 * Run an image-generation request with bounded retries. The image model
 * intermittently returns a response with no image file (or a transient gateway
 * error); without a retry that surfaces to users as a failed "Render again" or a
 * partially-filled capsule. Retries a few times with light backoff before
 * giving up (returns null so callers can handle the miss).
 */
async function renderImage(
  content: ({ type: "text"; text: string } | { type: "image"; image: URL })[],
  attempts = 3,
): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await generateText({
        model: env.modelImage,
        messages: [{ role: "user", content }],
      });
      const file = result.files.find((f) => f.mediaType.startsWith("image/"));
      if (file) return { bytes: file.uint8Array, mediaType: file.mediaType };
    } catch (err) {
      if (attempt === attempts - 1) {
        console.error("[image] generation failed after retries", err);
      }
    }
    if (attempt < attempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
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
  colorSeason: z.enum(["winter", "spring", "summer", "autumn"]),
  clarity: z
    .enum(["muted", "clear"])
    .describe(
      "overall colouring quality by CHROMA/SATURATION, not light/dark contrast: " +
        "'muted' = soft, greyed, dusty, low-saturation; 'clear' = bright, vivid, " +
        "high-saturation. Fair skin with dark hair is high value-contrast but is " +
        "often still 'muted' — judge saturation, not lightness.",
    ),
});

/** Step 1 — Vision analysis → physical attributes + colour season. */
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
              `and eye colour, and assign a seasonal colour analysis. Be objective and tactful — never judgmental. ` +
              `Also judge overall colouring CLARITY by chroma/saturation ('muted' vs 'clear'): ` +
              `muted = soft, greyed, dusty; clear = bright, vivid. Do NOT confuse high light/dark ` +
              `(value) contrast — e.g. fair skin with dark hair — for 'clear'; such colouring is ` +
              `frequently muted, which points to Summer rather than Winter. ` +
              `Context: age ${intake.age}, height ${intake.heightCm}cm, ${intake.genderPresentation}.` +
              (intake.hairColor
                ? ` Self-reported hair: ${HAIR_COLOR_LABELS[intake.hairColor]}.`
                : "") +
              (intake.eyeColor
                ? ` Self-reported eyes: ${EYE_COLOR_LABELS[intake.eyeColor]}.`
                : ""),
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
  const colorSeason = refineSeasonForClarity({
    season: output.colorSeason,
    undertone: output.undertone,
    clarity: output.clarity,
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
      undertone: output.undertone,
      contrast: output.contrast,
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
    },
    colorSeason,
    colorSubseason: classifySubseason({
      season: colorSeason,
      undertone: output.undertone,
      contrast: output.contrast,
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
    return ((data ?? []) as { content: string }[]).map((r) => r.content);
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
    reportPalette({ subseason, undertone, contrast }),
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
  language: ReportLanguage = "en",
): Promise<ReportContent> {
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

  const looksLine =
    lookCount <= 1
      ? `- Provide exactly 1 versatile look for everyday wear, with a ` +
        `3–4 colour hex palette and a one-line description of the outfit.\n`
      : `- Provide exactly ${lookCount} looks for different contexts (work, smart-casual, weekend), each with a ` +
        `3–4 colour hex palette and a one-line description of the outfit.\n` +
        `- Each look description MUST list every garment with its colour, comma-separated ` +
        `(e.g. "Powder-blue crewneck knit, grey-blue chinos, soft-denim loafers"). Use concrete catalogue words ` +
        `(blazer, overshirt, crewneck, chinos, trousers, loafers, sneakers) — not vague phrases like ` +
        `"textured layers" or "warm accents".\n`;

  const grounding = rules.length
    ? `Ground every recommendation in these established style rules:\n- ${rules.join("\n- ")}\n`
    : "";

  const { output } = await generateText({
    model: env.modelReasoning,
    output: Output.object({ schema: reportContentSchema }),
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
      `- The colour palette (best AND avoid) is supplied and fixed — you may return ` +
      `placeholder colours in "colors" (they are replaced), but the LOOKS must obey it.\n` +
      `- CRITICAL — colours: every look's "palette" hex codes AND every garment colour ` +
      `named in its "description" MUST be drawn ONLY from the client's BEST colours: ` +
      `${bestPaletteText}. Do not introduce colours outside this set — in particular no ` +
      `black, no charcoal, and no warm tan/camel/brown/olive/rust unless it literally appears ` +
      `above. Never use the AVOID colours (${avoidPaletteText}).\n` +
      `- For hair: exactly ${hairRecommend} recommended hairstyles and exactly ${hairAvoid} styles to avoid, ` +
      `each with a concrete reason tied to face shape (${profile.physical.faceShape}).\n` +
      `- Tailor the silhouette "fit" line and all 3 rules specifically to the "${profile.physical.bodyType}" body type: ` +
      `what to emphasise, what to balance, and which cuts/proportions to avoid for this shape. Reference the body type explicitly.\n` +
      `- Ensure the looks flatter this body type.\n` +
      looksLine +
      `- doList and dontList: 4 short, actionable items each.\n` +
      `Keep the tone refined and encouraging.` +
      languageInstruction(language),
  });

  // Pin the palette to the deterministic, subseason-curated set so identical
  // colouring always produces identical colours (the model's own palette,
  // which drifts run-to-run, is discarded).
  output.colors = colors;
  // Snap each look's palette onto the best colours so the generated look IMAGE
  // (which is prompted with look.palette) can't drift off-season even if the
  // model ignored the colour instruction above.
  output.looks = (output.looks ?? []).map((l) => ({
    ...l,
    palette: snapPaletteToBest(l.palette ?? [], colors.best),
  }));
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
}): Promise<{ context: string; title: string; description: string; palette: string[] }> {
  const { intake, profile, context, brief, note, rules, existingTitles, boldness, season } =
    opts;

  if (!hasAI) {
    const mock = mockReportContent(intake);
    const used = new Set((existingTitles ?? []).map((t) => t.toLowerCase()));
    const pick =
      mock.looks.find((l) => !used.has(l.title.toLowerCase())) ?? mock.looks[0]!;
    return { ...pick, context };
  }

  // Weave season + strictness into the brief text only — the look IMAGE prompt
  // (generateLookImage) is untouched by design; see look-brief.ts.
  const effectiveBrief = composeLookBrief(brief, { boldness, season });

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

  const { output } = await generateText({
    model: env.modelReasoning,
    output: Output.object({ schema: lookContentSchema }),
    prompt:
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
      avoid +
      grounding +
      `Produce exactly ONE look:\n` +
      `- context: "${context}".\n` +
      `- title: a short evocative name (2–4 words).\n` +
      `- description: ONE line naming each garment with its colour, comma-separated ` +
        `— concrete catalogue words only.\n` +
      `- CRITICAL — colours: the "palette" hex codes AND every garment colour in the ` +
        `"description" MUST be drawn ONLY from the client's BEST colours: ${bestPaletteText}. ` +
        `No black/charcoal and no warm tan/camel/brown/olive/rust unless it appears above. ` +
        `Never use the AVOID colours (${avoidPaletteText}).\n` +
      `Keep the tone refined and practical.` +
      languageInstruction(intake.language),
  });

  // Guarantee the returned palette is on-report even if the model drifted; the
  // look image is prompted from this palette.
  return { ...output, palette: snapPaletteToBest(output.palette ?? [], colors.best), context };
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
  /** Deep palette hex to place on the garment nearest the face (contrast/definition). */
  nearFaceHex?: string;
  /** EXPERIMENTAL — per-run prompt-version override (else `IMAGE_PROMPT_VERSION`). */
  promptVersion?: string | number | null;
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
    const catalogImageUrls = (look.catalogImageUrls ?? []).filter(Boolean);
    const hasCatalog = Boolean(look.catalogContext) || catalogImageUrls.length > 0;
    const hasOutfitRef = Boolean(outfitReferenceImageUrl);
    const hasFace = Boolean(faceReferenceImageUrl);
    const hasProfile = Boolean(profileReferenceImageUrl);
    const hasFull = Boolean(referenceImageUrl);
    const faceImageCount = (hasFace ? 1 : 0) + (hasProfile ? 1 : 0);
    const personImageCount = faceImageCount + (hasFull ? 1 : 0);
    const eyewearBlock = eyewearPromptDirective(look.description);
    const ordinals = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH"];
    const ordinal = (n: number) => ordinals[n - 1] ?? `${n}TH`;

    const subject =
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.bodyType} build. Soft natural light, neutral studio backdrop, ` +
      `confident relaxed pose, sharp focus, magazine quality. ` +
      `Vertical 9:16 framing, full body head to shoes visible. `;

    // When catalogue picks exist, THEY define the outfit. The free-text look
    // description is demoted to a styling/mood hint so it stops dominating and
    // re-creating the report's original look.
    const outfitBlock = hasCatalog
      ? `${look.catalogContext ?? ""}` +
        `Styling note (mood and proportions only — do NOT substitute different clothes): ${look.description}. `
      : `Outfit: ${look.description}. `;

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
      `listed (no extra jumper, knit, waistcoat or shirt). A knit may be worn on ` +
      `its own with a bare neckline — only show a shirt under a knit if a shirt is ` +
      `listed; never add an unlisted shirt beneath a knit. When BOTH a knit and a ` +
      `shirt are listed, the knit is worn OVER the shirt (a long-sleeve knit over a ` +
      `long-sleeve shirt so the collar and cuffs peek out), never a button-up shirt ` +
      `on top of a knit — EXCEPT a roll-neck / turtleneck, which is never worn with ` +
      `a collared shirt (no collar peeking out of, or sitting on top of, the roll-neck; ` +
      `the roll-neck replaces the shirt). A blazer, overshirt or coat is always the outermost layer. ` +
      `If sunglasses, glasses or ski goggles are listed, they are worn ON the face over the eyes — ` +
      `never held in a hand, tucked in a pocket, hanging from a shirt, or pushed up on the forehead. Match the ` +
      `named frame exactly: sunglasses may be round, wayfarer, aviator, rectangular, geometric, oval, wraparound sport, or ski goggles; ` +
      `optical glasses may be round, rectangular, oval, geometric, or rimless (lenses mounted directly to the bridge and temples, no surrounding frame). ` +
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
        faceImageCount > 0
          ? `The ${ordinal(imgIdx)} image is a full-length photo of the same person — use for ` +
            `body proportions and pose only. `
          : `The ${ordinal(imgIdx)} image shows the person — preserve their face, hair and ` +
            `identity exactly. `;
    }
    if (hasOutfitRef) {
      imgIdx += 1;
      imageRoles +=
        `The ${ordinal(imgIdx)} image shows the exact outfit to dress them in — copy only the clothing, ` +
        `colours and proportions; do not copy the model's face or body. `;
    }
    if (catalogImageUrls.length) {
      const catalogStart = imgIdx + 1;
      imgIdx += catalogImageUrls.length;
      if (catalogImageUrls.length === 1) {
        imageRoles +=
          `The ${ordinal(catalogStart)} image is the actual catalogue garment to dress them in — ` +
          `reproduce that exact garment on the person. `;
      } else {
        imageRoles +=
          `Images ${ordinal(catalogStart)} through ${ordinal(imgIdx)} are catalogue garment references — ` +
          `reproduce those exact garments on the person. `;
      }
      // When garment product photos share the prompt with the person's photos,
      // the model tends to blend faces from the product shots and lose likeness.
      // Make identity fidelity to the portrait override the garment references.
      // Only fires when BOTH exist — report look renders pass no catalogue images,
      // so their (good) likeness is untouched.
      if (personImageCount > 0) {
        imageRoles +=
          `CRITICAL identity rule: the person's face, bone structure, skin tone and hair ` +
          `come ONLY from ${faceImageCount > 0 ? "the portrait photo(s)" : "the person photo"} — ` +
          `reproduce them at maximum fidelity. The catalogue images are clothing swatches ` +
          `only: copy the garments, and take NOTHING facial, body or pose-related from them. `;
      }
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
        `Do NOT change the hair colour. ` +
        `Do NOT add or increase facial hair — no extra beard, stubble or moustache beyond ` +
        `what the reference photo shows. ` +
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
    const nearFaceBlock = nearFaceHex
      ? `Near-face colour: the garment closest to the face (the top layer — knit, ` +
        `shirt, jacket or its collar) MUST be ${nearFaceHex} — a deliberate tone from ` +
        `the palette. If the outfit text names a lighter or mid-value top, deepen it to ` +
        `this tone; other garments keep their described colours. `
      : nearFacePrinciple;

    const preamble =
      `Editorial, full-length fashion photograph for a premium style report. `;
    const paletteLine = `Colour palette: ${look.palette.join(", ")}. `;

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
      NO_TEXT_RULE;

    // EXPERIMENTAL prompt versioning (see look-prompt.ts). v2+ pull the hard
    // negatives out of the descriptive blocks into one trailing Constraints
    // group; `layeringOrder` is the positive-only remainder of `layeringRule`.
    const layeringOrder =
      `A knit may be worn on its own with a bare neckline — only show a shirt ` +
      `under a knit if a shirt is listed. When both a knit and a shirt are worn, ` +
      `a long-sleeve knit goes OVER a long-sleeve shirt (only the shirt's collar ` +
      `and cuffs peek out); a roll-neck or turtleneck is never worn with a collared ` +
      `shirt — it replaces the shirt. A blazer, overshirt or coat is always the outermost ` +
      `layer. Sunglasses, glasses or ski goggles, when listed, sit on the face over the eyes ` +
      `in the named frame shape. Rimless glasses have no surrounding frame — the lenses attach directly to the bridge and temples. Ski goggles cover both eyes as a visor, not on the forehead. `;
    const constraints = [
      `render EXACTLY the garments listed — do not add any layer that is not ` +
        `listed (no extra jumper, knit, waistcoat or shirt)`,
      `trousers described as "suit", "tailored" or "dress" trousers, or chinos, ` +
        `are smooth woven wool or cotton — never blue or washed denim / jeans, ` +
        `even if the item name contains the word "washed"`,
      `no text, letters, words, captions, labels, headings, watermarks, logos, ` +
        `numbers, arrows or graphic overlays anywhere in the frame`,
      `sunglasses, glasses or ski goggles listed in the outfit are worn on the face over the ` +
        `eyes in the named frame shape — not held, not in a pocket, not hanging from clothing, not on the forehead`,
    ];
    if (eyewearBlock) {
      constraints.push(
        `listed eyewear is mandatory on the face — never render a bare face if sunglasses, glasses or goggles appear in the outfit`,
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
          ? `The ${ord} image is a full-length photo of the same person — use only for body ` +
            `proportions. `
          : `The ${ord} image is a photo of the person — preserve their face, hair, skin tone ` +
            `and identity exactly; this is that same person. `;
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
        `what the reference photo shows. Render the face at maximum fidelity to the portrait. `;
    }

    const prompt =
      `Cover photograph for a luxury men's style magazine — a single full-length ` +
      `editorial hero shot in a bright, airy, high-key style. ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.bodyType} build, dressed in refined, well-tailored clothing` +
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
 * the person from their own full-length photo in 1–4 exact catalogue garments,
 * preserving identity, pose, background and lighting, with correct layering
 * (outerwear over a base layer — never on bare skin).
 */
export async function generateCatalogTryOnImage(opts: {
  personImageUrl: string;
  garments: CatalogTryOnGarment[];
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI || !opts.garments.length) return null;
  try {
    const garments = opts.garments.slice(0, 4);
    const garmentImageUrls = garments
      .map((g) => g.imageUrl)
      .filter((u): u is string => Boolean(u && /^https?:\/\//i.test(u)));

    const garmentLines = garments.map((g, i) => {
      const colour =
        g.color && g.color !== "#CCCCCC" ? `, colour ${g.color}` : "";
      return `${i + 1}. ${g.title} (${g.category.toLowerCase()}${colour})`;
    });

    const prompt =
      `Photorealistic virtual try-on. ` +
      `The FIRST image is the customer's own full-length photo. Recreate this exact ` +
      `photograph changing ONLY the clothing listed below. Preserve the person's ` +
      `identity perfectly: same face and expression, same hairstyle, same skin tone, ` +
      `same body shape and proportions, same pose and hand positions, same background, ` +
      `same camera angle, perspective and lighting. ` +
      (garmentImageUrls.length
        ? `The remaining ${garmentImageUrls.length} image(s) show the actual catalogue ` +
          `garment(s) — reproduce these exact products, not similar ones. `
        : ``) +
      `Dress the person in these catalogue pieces:\n${garmentLines.join("\n")}\n` +
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
    for (const url of garmentImageUrls) {
      try {
        content.push({ type: "image", image: new URL(url) });
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
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const garmentImageUrls = (opts.garmentImageUrls ?? []).filter(
      (u): u is string => Boolean(u && /^https?:\/\//i.test(u)),
    );
    const eyewearBlock = eyewearPromptDirective(opts.garmentsText);

    const prompt =
      `Photorealistic virtual try-on for a style report. ` +
      `The FIRST image is the customer's own full-length photo. Recreate this ` +
      `photograph of the SAME person, changing only their CLOTHING and the ` +
      `BACKGROUND. ` +
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
      (garmentImageUrls.length
        ? `The remaining ${garmentImageUrls.length} image(s) show the actual ` +
          `catalogue garment(s) — reproduce these exact products, not similar ones. `
        : ``) +
      opts.garmentsText +
      `Layering — follow strictly: outerwear (jackets, blazers, coats, overshirts, ` +
      `cardigans) is always worn OVER a base layer, never on bare skin. A knit may ` +
      `be worn on its own; only show a shirt under a knit if a shirt is listed, and ` +
      `then a long-sleeve knit goes OVER a long-sleeve shirt (collar and cuffs peek ` +
      `out), never a shirt over a knit. A roll-neck or turtleneck is never worn with ` +
      `a collared shirt — no collar peeking out of or sitting on the roll-neck; the ` +
      `roll-neck replaces the shirt. If sunglasses, glasses or ski goggles are listed, they are ` +
      `worn ON the face over the eyes — never held in a hand, in a pocket, hanging ` +
      `from a shirt, or pushed onto the forehead — in the named frame shape. Rimless glasses ` +
      `have lenses mounted directly to the bridge and temples with no surrounding frame. ` +
      `Trousers described as "suit", "tailored" or ` +
      `"dress" trousers or chinos are smooth woven wool or cotton — never blue or ` +
      `washed denim, even if the item name contains "washed". ` +
      `Reproduce each garment faithfully — exact colour, fabric texture, pattern, ` +
      `buttons, zips, stitching, fit and proportions — with natural drape and ` +
      `realistic shadows. The result must look like a real photograph of the SAME ` +
      `person, same face, now wearing the new outfit against a clean studio ` +
      `backdrop.` +
      eyewearBlock +
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
export async function generateHairImage(opts: {
  profile: StyleProfile;
  hair: { name: string; why: string };
  recommend: boolean;
  referenceImageUrl?: string;
  angle?: "front" | "profile" | "three_quarter";
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
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only change the hairstyle.`
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
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only change the facial hair style.`
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
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only add or change the eyewear.`
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
function outfitPaletteGuidance(profile: StyleProfile): string {
  const u = (profile.physical.undertone ?? "").toLowerCase();
  const season = profile.colorSeason ? ` (${profile.colorSeason})` : "";
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
      `${outfitPaletteGuidance(profile)} ` +
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
      `${outfitPaletteGuidance(profile)} ` +
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
  const content = await recommend(
    intake,
    profile,
    rules,
    lookCount,
    tier,
    intake.language,
  );
  return { profile, content };
}
