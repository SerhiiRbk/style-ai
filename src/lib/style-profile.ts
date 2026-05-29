import { z } from "zod";

/**
 * Canonical Style Profile contract. Generated once from the user's photos +
 * questionnaire and reused by every downstream step (report, looks, try-on,
 * look builder). Validated with zod so model output is always well-formed.
 */

export const GenderPresentation = z.enum(["male", "female", "non-binary"]);
export const Boldness = z.enum([
  "conservative",
  "moderate",
  "experimental",
  "statement",
]);
export const ColorSeason = z.enum([
  "winter",
  "spring",
  "summer",
  "autumn",
]);

export const intakeSchema = z.object({
  age: z.number().int().min(16).max(99),
  genderPresentation: GenderPresentation,
  city: z.string().min(1),
  country: z.string().min(1),
  heightCm: z.number().int().min(120).max(230),
  occupation: z.string().min(1),
  lifestyle: z.array(z.string()).default([]),
  goals: z.array(z.string()).min(1),
  boldness: Boldness,
  budgetEur: z.object({ min: z.number(), max: z.number() }),
  notes: z.string().optional(),
});
export type Intake = z.infer<typeof intakeSchema>;

export const colorRecSchema = z.object({
  name: z.string(),
  hex: z.string(),
  why: z.string(),
});
export const hairRecSchema = z.object({ name: z.string(), why: z.string() });
export const lookContentSchema = z.object({
  context: z.string(),
  title: z.string(),
  description: z.string(),
  palette: z.array(z.string()),
});

/** Structured report content produced by the reasoning model (Output.object). */
export const reportContentSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  colors: z.object({
    best: z.array(colorRecSchema),
    avoid: z.array(colorRecSchema),
  }),
  hair: z.object({
    recommend: z.array(hairRecSchema),
    avoid: z.array(hairRecSchema),
  }),
  silhouette: z.object({ fit: z.string(), rules: z.array(z.string()) }),
  looks: z.array(lookContentSchema),
  doList: z.array(z.string()),
  dontList: z.array(z.string()),
});
export type ReportContent = z.infer<typeof reportContentSchema>;

export const styleProfileSchema = z.object({
  version: z.literal("1.0"),
  demographics: z.object({
    age: z.number(),
    genderPresentation: GenderPresentation,
    city: z.string(),
    country: z.string(),
    climate: z.string(),
  }),
  physical: z.object({
    skinTone: z.string(),
    undertone: z.enum(["warm", "cool", "neutral"]),
    contrast: z.enum(["low", "medium", "high"]),
    faceShape: z.string(),
    bodyType: z.string(),
    heightCm: z.number(),
  }),
  colorSeason: ColorSeason,
  goals: z.array(z.string()),
  boldness: Boldness,
  budgetEur: z.object({ min: z.number(), max: z.number() }),
});
export type StyleProfile = z.infer<typeof styleProfileSchema>;
