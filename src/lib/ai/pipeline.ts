import "server-only";
import { generateText, Output, embed } from "ai";
import { z } from "zod";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { climateFor, mockStyleProfile, mockReportContent } from "@/lib/report";
import {
  reportContentSchema,
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
      bodyType: output.bodyType,
      heightCm: intake.heightCm,
    },
    colorSeason: output.colorSeason,
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

/** Step 3 — Explainable report content grounded in the retrieved rules. */
export async function recommend(
  intake: Intake,
  profile: StyleProfile,
  rules: string[],
): Promise<ReportContent> {
  if (!hasAI) return mockReportContent(intake);

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
      `City climate: ${profile.demographics.climate}.\n\n` +
      `${grounding}\n` +
      `Produce an explainable style report. Requirements:\n` +
      `- For every colour (best AND avoid) include a hex code and a concrete "why" tied to the profile.\n` +
      `- For hair, recommend and avoid with reasons tied to face shape.\n` +
      `- Give a silhouette "fit" line and 3 concrete rules.\n` +
      `- Provide exactly 3 looks for different contexts (work, smart-casual, weekend), each with a ` +
      `3–4 colour hex palette and a one-line description of the outfit.\n` +
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
  look: { title: string; description: string; palette: string[] };
  referenceImageUrl?: string;
}): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!hasAI) return null;
  try {
    const { profile, look, referenceImageUrl } = opts;
    const prompt =
      `Editorial, full-length fashion photograph for a premium style report. ` +
      `Outfit: ${look.description}. Colour palette: ${look.palette.join(", ")}. ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.bodyType} build. Soft natural light, neutral studio backdrop, ` +
      `confident relaxed pose, sharp focus, magazine quality. ` +
      (referenceImageUrl
        ? `Preserve the face and identity of the person in the provided photo.`
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
): Promise<{ profile: StyleProfile; content: ReportContent }> {
  const profile = await analyzeProfile(intake, photos);
  const rules = await retrieveRules(profile);
  const content = await recommend(intake, profile, rules);
  return { profile, content };
}
