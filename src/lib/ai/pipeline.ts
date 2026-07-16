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
  HAIR_COLOR_LABELS,
  EYE_COLOR_LABELS,
  type HairColorId,
  type EyeColorId,
  type Intake,
  type StyleProfile,
  type ReportContent,
} from "@/lib/style-profile";
import { languageInstruction, type ReportLanguage } from "@/lib/languages";

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
    ? HAIR_COLOR_LABELS[intake.hairColor as HairColorId]
    : output.hairColor;
  const eyeColor = intake.eyeColor
    ? EYE_COLOR_LABELS[intake.eyeColor as EyeColorId]
    : output.eyeColor;

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
    colorSeason: output.colorSeason,
    colorSubseason: classifySubseason({
      season: output.colorSeason,
      undertone: output.undertone,
      contrast: output.contrast,
      hairColor,
      eyeColor,
    }),
    currency: intake.currency,
    goals: intake.goals,
    lifestyle: intake.lifestyle ?? [],
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
  if (!hasAI) return mockReportContent(intake);

  const hairRecommend = hairRecommendGenLimit(tier);
  const hairAvoid = HAIR_AVOID_GEN_LIMIT;

  const looksLine =
    lookCount <= 1
      ? `- Provide exactly 1 versatile look for everyday wear, with a ` +
        `3–4 colour hex palette and a one-line description of the outfit.\n`
      : `- Provide exactly ${lookCount} looks for different contexts (work, smart-casual, weekend), each with a ` +
        `3–4 colour hex palette and a one-line description of the outfit.\n` +
        `- Each look description MUST list every garment with its colour, comma-separated ` +
        `(e.g. "Rust crewneck knit, olive chinos, brown leather loafers"). Use concrete catalogue words ` +
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
      `- For every colour (best AND avoid) include a hex code and a concrete "why" tied to the profile.\n` +
      (profile.colorSubseason
        ? `- Calibrate the palette to the client's ${profile.colorSubseason.replace("-", " ")} colouring ` +
          `(hair: ${profile.physical.hairColor ?? "n/a"}, eyes: ${profile.physical.eyeColor ?? "n/a"}) — ` +
          `respect its depth, temperature and chroma.\n`
        : "") +
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
}): Promise<{ context: string; title: string; description: string; palette: string[] }> {
  const { intake, profile, context, brief, note, rules, existingTitles } = opts;

  if (!hasAI) {
    const mock = mockReportContent(intake);
    const used = new Set((existingTitles ?? []).map((t) => t.toLowerCase()));
    const pick =
      mock.looks.find((l) => !used.has(l.title.toLowerCase())) ?? mock.looks[0]!;
    return { ...pick, context };
  }

  const grounding = rules?.length
    ? `Ground the look in these established style rules:\n- ${rules.join("\n- ")}\n`
    : "";
  const avoid = existingTitles?.length
    ? `Avoid repeating these existing looks (make this one clearly different in title and outfit): ${existingTitles.join("; ")}.\n`
    : "";
  const noteLine = note?.trim()
    ? `User request for this specific look: "${note.trim()}". Honour it within the occasion and the profile.\n`
    : "";

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
      `Occasion: ${context}. Styling brief: ${brief}\n` +
      noteLine +
      avoid +
      grounding +
      `Produce exactly ONE look:\n` +
      `- context: "${context}".\n` +
      `- title: a short evocative name (2–4 words).\n` +
      `- description: ONE line naming each garment with its colour, comma-separated ` +
        `(e.g. "Camel crewneck knit, taupe chinos, brown loafers") — concrete catalogue words only.\n` +
      `- palette: 3–4 hex codes aligned with the client's best colours.\n` +
      `Keep the tone refined and practical.` +
      languageInstruction(intake.language),
  });

  return { ...output, context };
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
  /** Pre-rendered outfit photo (e.g. capsule combo) — clothing reference only. */
  outfitReferenceImageUrl?: string;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const {
      profile,
      look,
      referenceImageUrl,
      faceReferenceImageUrl,
      outfitReferenceImageUrl,
    } = opts;
    const catalogImageUrls = (look.catalogImageUrls ?? []).filter(Boolean);
    const hasCatalog = Boolean(look.catalogContext) || catalogImageUrls.length > 0;
    const hasOutfitRef = Boolean(outfitReferenceImageUrl);
    const hasFace = Boolean(faceReferenceImageUrl);
    const hasFull = Boolean(referenceImageUrl);
    const personImageCount = (hasFace ? 1 : 0) + (hasFull ? 1 : 0);
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

    // Describe the role of each input image so identity (person photo) and the
    // garments (catalogue product photos) are not confused.
    let imageRoles = "";
    if (personImageCount > 0) {
      if (hasFace && hasFull) {
        imageRoles +=
          `The ${ordinal(1)} image is a close-up portrait — match this person's face, hair and identity exactly. ` +
          `The ${ordinal(2)} image is a full-length photo of the same person — use for body proportions and pose only. `;
      } else {
        imageRoles +=
          `The ${ordinal(1)} image shows the person — preserve their face, hair and identity exactly. `;
      }
    }
    if (hasOutfitRef) {
      const outfitIdx = personImageCount + 1;
      imageRoles +=
        `The ${ordinal(outfitIdx)} image shows the exact outfit to dress them in — copy only the clothing, ` +
        `colours and proportions; do not copy the model's face or body. `;
    }
    if (catalogImageUrls.length) {
      const catalogStart = personImageCount + (hasOutfitRef ? 1 : 0) + 1;
      if (catalogImageUrls.length === 1) {
        imageRoles +=
          `The ${ordinal(catalogStart)} image is the actual catalogue garment to dress them in — ` +
          `reproduce that exact garment on the person. `;
      } else {
        imageRoles +=
          `Images ${ordinal(catalogStart)} through ${ordinal(catalogStart + catalogImageUrls.length - 1)} are catalogue garment references — ` +
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
          `come ONLY from ${hasFace ? "the close-up portrait" : "the person photo"} — ` +
          `reproduce them at maximum fidelity. The catalogue images are clothing swatches ` +
          `only: copy the garments, and take NOTHING facial, body or pose-related from them. `;
      }
    }
    if (!personImageCount && !catalogImageUrls.length) {
      imageRoles = `Do not show identifiable facial features. `;
    } else if (!personImageCount && catalogImageUrls.length) {
      imageRoles =
        `The provided image(s) are the actual catalogue garments to render as the outfit. ` +
        `Do not show identifiable facial features. `;
    }

    const prompt =
      `Editorial, full-length fashion photograph for a premium style report. ` +
      outfitBlock +
      footwearBlock +
      `Colour palette: ${look.palette.join(", ")}. ` +
      subject +
      imageRoles +
      NO_TEXT_RULE;

    const content: (
      | { type: "text"; text: string }
      | { type: "image"; image: URL }
    )[] = [{ type: "text", text: prompt }];
    if (faceReferenceImageUrl) {
      content.push({ type: "image", image: new URL(faceReferenceImageUrl) });
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
  } catch {
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
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const { profile, referenceImageUrl } = opts;
    const palette = (opts.palette ?? []).filter(Boolean);

    const prompt =
      `Cover photograph for a luxury men's style magazine — a single striking ` +
      `full-length editorial hero shot. ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.bodyType} build, dressed in refined, well-tailored clothing` +
      (palette.length ? ` in a ${palette.join(", ")} colour palette. ` : ". ") +
      (opts.archetype ? `Overall mood: ${opts.archetype}. ` : "") +
      `Confident, poised stance, editorial fashion energy. Cinematic soft directional ` +
      `light, refined minimalist studio backdrop with a subtle warm tone. ` +
      `Vertical full-length cover framing (taller than wide), the subject centred with ` +
      `generous clean empty space above the head and below the feet so a magazine ` +
      `masthead and cover lines can be overlaid later. Sharp focus, high-end retouching, ` +
      `magazine cover quality. ` +
      (referenceImageUrl
        ? `Preserve the face, hair, skin tone and identity of the person in the provided ` +
          `photo exactly — this is a portrait of that same person.`
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
