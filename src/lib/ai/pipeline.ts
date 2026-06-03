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
  inferBodyTypeFromMeasurements,
  type Intake,
  type StyleProfile,
  type ReportContent,
} from "@/lib/style-profile";

export type PhotoInput = { role: string; url: string };

const visionSchema = z.object({
  skinTone: z.string().describe("e.g. 'warm medium', 'cool fair'"),
  undertone: z.enum(["warm", "cool", "neutral"]),
  contrast: z.enum(["low", "medium", "high"]),
  faceShape: z.string().describe("e.g. oval, round, square, oblong, heart"),
  bodyType: z.string().describe("e.g. rectangle, triangle, inverted-triangle"),
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
              `Determine skin tone, undertone, facial contrast, face shape and body type, and assign a ` +
              `seasonal colour analysis. Be objective and tactful — never judgmental. ` +
              `Context: age ${intake.age}, height ${intake.heightCm}cm, ${intake.genderPresentation}.`,
          },
          ...photos.map((p) => ({ type: "image" as const, image: new URL(p.url) })),
        ],
      },
    ],
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
    },
    colorSeason: output.colorSeason,
    currency: intake.currency,
    goals: intake.goals,
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
): Promise<ReportContent> {
  if (!hasAI) return mockReportContent(intake);

  const hairRecommend = hairRecommendGenLimit(tier);
  const hairAvoid = HAIR_AVOID_GEN_LIMIT;

  const looksLine =
    lookCount <= 1
      ? `- Provide exactly 1 versatile look for everyday wear, with a ` +
        `3–4 colour hex palette and a one-line description of the outfit.\n`
      : `- Provide exactly ${lookCount} looks for different contexts (work, smart-casual, weekend), each with a ` +
        `3–4 colour hex palette and a one-line description of the outfit.\n`;

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
      `Boldness: ${intake.boldness}. Budget: €${intake.budgetEur.min}–${intake.budgetEur.max}. ` +
      `City climate: ${profile.demographics.climate}.\n` +
      `Body type: ${profile.physical.bodyType}${measurementsSummary(profile.physical.measurements)}.\n\n` +
      `${grounding}\n` +
      `Produce an explainable style report. Requirements:\n` +
      `- For every colour (best AND avoid) include a hex code and a concrete "why" tied to the profile.\n` +
      `- For hair: exactly ${hairRecommend} recommended hairstyles and exactly ${hairAvoid} styles to avoid, ` +
      `each with a concrete reason tied to face shape (${profile.physical.faceShape}).\n` +
      `- Tailor the silhouette "fit" line and all 3 rules specifically to the "${profile.physical.bodyType}" body type: ` +
      `what to emphasise, what to balance, and which cuts/proportions to avoid for this shape. Reference the body type explicitly.\n` +
      `- Ensure the looks flatter this body type.\n` +
      looksLine +
      `- doList and dontList: 4 short, actionable items each.\n` +
      `Keep the tone refined and encouraging.`,
  });

  return output;
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
  };
  referenceImageUrl?: string;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const { profile, look, referenceImageUrl } = opts;
    const catalogImageUrls = (look.catalogImageUrls ?? []).filter(Boolean);
    const hasCatalog = Boolean(look.catalogContext) || catalogImageUrls.length > 0;

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

    // Describe the role of each input image so identity (person photo) and the
    // garments (catalogue product photos) are not confused.
    let imageRoles = "";
    if (referenceImageUrl && catalogImageUrls.length) {
      imageRoles =
        `The FIRST image shows the person — preserve their face, hair and identity exactly. ` +
        `The remaining ${catalogImageUrls.length} image(s) are the actual catalogue garments to dress them in — ` +
        `reproduce those exact garments on the person. `;
    } else if (referenceImageUrl) {
      imageRoles = `Preserve the face and identity of the person in the provided photo. `;
    } else if (catalogImageUrls.length) {
      imageRoles =
        `The provided image(s) are the actual catalogue garments to render as the outfit. ` +
        `Do not show identifiable facial features. `;
    } else {
      imageRoles = `Do not show identifiable facial features. `;
    }

    const prompt =
      `Editorial, full-length fashion photograph for a premium style report. ` +
      outfitBlock +
      `Colour palette: ${look.palette.join(", ")}. ` +
      subject +
      imageRoles;

    const content: (
      | { type: "text"; text: string }
      | { type: "image"; image: URL }
    )[] = [{ type: "text", text: prompt }];
    if (referenceImageUrl) {
      content.push({ type: "image", image: new URL(referenceImageUrl) });
    }
    for (const url of catalogImageUrls) {
      try {
        content.push({ type: "image", image: new URL(url) });
      } catch {
        // Skip malformed product URLs rather than failing the whole render.
      }
    }

    const result = await generateText({
      model: env.modelImage,
      messages: [{ role: "user", content }],
    });
    const file = result.files.find((f) => f.mediaType.startsWith("image/"));
    return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
  } catch {
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
      ? `Show this hairstyle as a flattering recommendation: ${hair.name}. ${hair.why}`
      : `Show this hairstyle as an example to avoid: ${hair.name}. ${hair.why}`;

    const angleNote =
      angle === "front"
        ? "Face the camera directly, front-facing headshot."
        : angle === "profile"
          ? "Head turned to a side profile (90°), showing the hairstyle silhouette from the side."
          : "Head turned roughly 45° (three-quarter view), showing the hairstyle from the side while keeping most of the face visible.";

    const prompt =
      `Editorial beauty headshot for a premium grooming report. ` +
      `Hairstyle: ${hair.name}. ${intent} ` +
      `Camera angle: ${angleNote} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on hair and face, magazine quality, tasteful and respectful. ` +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only change the hairstyle.`
        : `Do not show identifiable facial features.`);

    const content = referenceImageUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: new URL(referenceImageUrl) },
        ]
      : [{ type: "text" as const, text: prompt }];

    const result = await generateText({
      model: env.modelImage,
      messages: [{ role: "user", content }],
    });
    const file = result.files.find((f) => f.mediaType.startsWith("image/"));
    return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
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
      `Facial hair style: ${style.name}. ${style.why} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on face and facial hair, magazine quality, tasteful and respectful. ` +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only change the facial hair style.`
        : `Do not show identifiable facial features.`);

    const content = referenceImageUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: new URL(referenceImageUrl) },
        ]
      : [{ type: "text" as const, text: prompt }];

    const result = await generateText({
      model: env.modelImage,
      messages: [{ role: "user", content }],
    });
    const file = result.files.find((f) => f.mediaType.startsWith("image/"));
    return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
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
      `${eyewearType}: ${frame.name}${frame.shape ? ` (${frame.shape} shape)` : ""}. ${frame.why} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on face and ${isSun ? "sunglasses" : "glasses"}, magazine quality, tasteful and respectful. ` +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only add or change the eyewear.`
        : `Do not show identifiable facial features.`);

    const content = referenceImageUrl
      ? [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: new URL(referenceImageUrl) },
        ]
      : [{ type: "text" as const, text: prompt }];

    const result = await generateText({
      model: env.modelImage,
      messages: [{ role: "user", content }],
    });
    const file = result.files.find((f) => f.mediaType.startsWith("image/"));
    return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
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
