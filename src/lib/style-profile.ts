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

export const Currency = z.enum(["EUR", "USD", "CZK", "PLN"]);

export const BodyType = z.enum([
  "rectangle",
  "trapezoid",
  "triangle",
  "inverted-triangle",
  "hourglass",
  "oval",
]);
export type BodyTypeId = z.infer<typeof BodyType>;

export const BODY_TYPE_LABELS: Record<BodyTypeId, string> = {
  rectangle: "Rectangle",
  trapezoid: "Athletic",
  triangle: "Triangle",
  "inverted-triangle": "Inverted",
  hourglass: "Hourglass",
  oval: "Oval",
};

/** Type guard: is an arbitrary string one of our known body types? */
export function isBodyType(
  id: string | undefined | null,
): id is BodyTypeId {
  return !!id && (BodyType.options as readonly string[]).includes(id);
}

/** Optional body measurements (cm). Used to derive a default body type. */
export const measurementsSchema = z.object({
  shoulderCm: z.number().min(40).max(200).optional(),
  chestCm: z.number().min(40).max(200).optional(),
  waistCm: z.number().min(40).max(200).optional(),
  hipCm: z.number().min(40).max(200).optional(),
  sleeveCm: z.number().min(30).max(110).optional(),
});
export type Measurements = z.infer<typeof measurementsSchema>;

/**
 * Pick a sensible default body type from shoulder / waist / hip girths.
 * Scale-independent (uses ratios) and constrained to the current gender's set:
 *  - trapezoid (Athletic) is male-only; hourglass is non-male-only.
 * Returns undefined when shoulder or hip is missing.
 */
export function inferBodyTypeFromMeasurements(
  m: Measurements | undefined,
  gender: string,
): BodyTypeId | undefined {
  if (!m?.shoulderCm || !m?.hipCm) return undefined;
  const S = m.shoulderCm;
  const H = m.hipCm;
  const W = m.waistCm ?? Math.min(S, H);
  const avg = (S + H) / 2;
  const hasTrapezoid = gender === "male";
  const hasHourglass = gender !== "male";

  const shoulderDominance = (S - H) / avg;
  const waistRatio = W / avg;

  if (waistRatio >= 0.97) return "oval"; // belly dominates
  if (shoulderDominance <= -0.05) return "triangle"; // hips dominate
  if (shoulderDominance >= 0.1) return "inverted-triangle"; // dramatic V
  if (shoulderDominance >= 0.04)
    return hasTrapezoid ? "trapezoid" : "inverted-triangle"; // moderate V
  if (waistRatio <= 0.86 && hasHourglass) return "hourglass"; // defined waist
  return "rectangle";
}

export const intakeSchema = z.object({
  age: z.number().int().min(16).max(99),
  genderPresentation: GenderPresentation,
  city: z.string().min(1),
  country: z.string().min(1),
  currency: Currency.default("EUR"),
  heightCm: z.number().int().min(120).max(230),
  weightKg: z.number().int().min(30).max(300).optional(),
  bodyType: BodyType.optional(),
  measurements: measurementsSchema.optional(),
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
    weightKg: z.number().optional(),
    measurements: measurementsSchema.optional(),
  }),
  colorSeason: ColorSeason,
  currency: Currency.default("EUR"),
  goals: z.array(z.string()),
  boldness: Boldness,
  budgetEur: z.object({ min: z.number(), max: z.number() }),
});
export type StyleProfile = z.infer<typeof styleProfileSchema>;
