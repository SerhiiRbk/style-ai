import { z } from "zod";
import { REPORT_LANGUAGE_IDS, DEFAULT_LANGUAGE } from "@/lib/languages";

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

/** 12-subseason colour analysis (3 per season, by depth / chroma / temperature). */
export const Subseason = z.enum([
  "deep-winter",
  "cool-winter",
  "bright-winter",
  "bright-spring",
  "warm-spring",
  "light-spring",
  "light-summer",
  "cool-summer",
  "soft-summer",
  "soft-autumn",
  "warm-autumn",
  "deep-autumn",
]);
export type SubseasonId = z.infer<typeof Subseason>;

export const SUBSEASON_LABELS: Record<SubseasonId, string> = {
  "deep-winter": "Deep Winter",
  "cool-winter": "Cool Winter",
  "bright-winter": "Bright Winter",
  "bright-spring": "Bright Spring",
  "warm-spring": "Warm Spring",
  "light-spring": "Light Spring",
  "light-summer": "Light Summer",
  "cool-summer": "Cool Summer",
  "soft-summer": "Soft Summer",
  "soft-autumn": "Soft Autumn",
  "warm-autumn": "Warm Autumn",
  "deep-autumn": "Deep Autumn",
};

export const SUBSEASON_BY_SEASON: Record<
  z.infer<typeof ColorSeason>,
  SubseasonId[]
> = {
  winter: ["cool-winter", "deep-winter", "bright-winter"],
  spring: ["warm-spring", "bright-spring", "light-spring"],
  summer: ["cool-summer", "soft-summer", "light-summer"],
  autumn: ["warm-autumn", "deep-autumn", "soft-autumn"],
};

export const HairColor = z.enum([
  "black",
  "dark-brown",
  "brown",
  "dark-blonde",
  "light-blonde",
  "auburn",
  "bright-red",
  "gray",
  "other",
]);
export type HairColorId = z.infer<typeof HairColor>;

export const HAIR_COLOR_LABELS: Record<HairColorId, string> = {
  black: "Black",
  "dark-brown": "Dark brown",
  brown: "Brown",
  "dark-blonde": "Dark blonde",
  "light-blonde": "Light blonde",
  auburn: "Auburn",
  "bright-red": "Bright red",
  gray: "Gray / white",
  other: "Other",
};

/** Legacy intake/profile ids → current ids (pre dark/light blonde & auburn split). */
const HAIR_COLOR_ALIASES: Record<string, HairColorId> = {
  blonde: "dark-blonde",
  red: "auburn",
};

/** Map a stored or submitted hair-colour id onto the current enum (or undefined). */
export function normalizeHairColorId(
  raw: string | null | undefined,
): HairColorId | undefined {
  if (!raw) return undefined;
  if (raw in HAIR_COLOR_LABELS) return raw as HairColorId;
  return HAIR_COLOR_ALIASES[raw];
}

/** Zod field that accepts current ids and legacy `blonde` / `red`. */
export const HairColorField = z.preprocess(
  (v) => (typeof v === "string" ? normalizeHairColorId(v) ?? v : v),
  HairColor.optional(),
);

export const EyeColor = z.enum([
  "brown",
  "hazel",
  "amber",
  "green",
  "blue",
  "gray",
  "other",
]);
export type EyeColorId = z.infer<typeof EyeColor>;

export const EYE_COLOR_LABELS: Record<EyeColorId, string> = {
  brown: "Brown",
  hazel: "Hazel",
  amber: "Amber",
  green: "Green",
  blue: "Blue",
  gray: "Gray",
  other: "Other",
};

/** Coarse depth signal from hair + eye colouring, falling back to facial contrast. */
function depthFromColouring(
  contrast: "low" | "medium" | "high",
  hairColor?: string | null,
  eyeColor?: string | null,
): "deep" | "light" | "medium" {
  const hair = (hairColor ?? "").toLowerCase();
  const eye = (eyeColor ?? "").toLowerCase();
  // "dark blonde" must NOT count as dark hair — only truly deep colours.
  const darkHair =
    /\b(black|jet|espresso)\b/.test(hair) ||
    /\bdark[\s-]*brown\b/.test(hair) ||
    (/\bdark\b/.test(hair) && !/\bblond/.test(hair));
  // Light blonde / platinum / grey — not dark-blonde (dirty / honey).
  const lightHair =
    /\b(platinum|gray|grey|white|silver)\b/.test(hair) ||
    /\blight[\s-]*blond/.test(hair) ||
    (/\bblond/.test(hair) && /\blight\b/.test(hair));
  const darkEye = /\b(brown|black|amber)\b/.test(eye) && !/\blight\b/.test(eye);
  const lightEye = /\b(blue|gray|grey|green|hazel|light)\b/.test(eye);

  if (darkHair && darkEye) return "deep";
  if (lightHair && lightEye) return "light";
  if (contrast === "high") return "deep";
  if (contrast === "low") return "light";
  return "medium";
}

/** High-chroma reds (bright ginger) tip spring/winter toward the "bright" subseason. */
function isBrightHair(hairColor?: string | null): boolean {
  const hair = (hairColor ?? "").toLowerCase();
  return /\b(bright[\s-]*red|ginger|vibrant\s*red)\b/.test(hair);
}

/**
 * Map the 4-season base + temperature/contrast (and optional hair/eye colour)
 * onto one of the 12 subseasons. Deterministic — a richer classification than a
 * plain "warm/deep" prefix, grounded in the strongest available signals.
 */
export function classifySubseason(opts: {
  season: z.infer<typeof ColorSeason>;
  undertone: "warm" | "cool" | "neutral";
  contrast: "low" | "medium" | "high";
  hairColor?: string | null;
  eyeColor?: string | null;
}): SubseasonId {
  const { season, undertone, contrast, hairColor, eyeColor } = opts;
  const depth = depthFromColouring(contrast, hairColor, eyeColor);
  const brightHair = isBrightHair(hairColor);

  switch (season) {
    case "winter":
      if (depth === "deep") return "deep-winter";
      if (undertone === "cool" && !brightHair) return "cool-winter";
      return "bright-winter";
    case "spring":
      if (depth === "light") return "light-spring";
      if (contrast === "high" || brightHair) return "bright-spring";
      return "warm-spring";
    case "summer":
      if (depth === "light") return "light-summer";
      if (depth === "deep" || contrast === "high") return "cool-summer";
      return "soft-summer";
    case "autumn":
      if (depth === "deep") return "deep-autumn";
      if (depth === "light" || contrast === "low") return "soft-autumn";
      return "warm-autumn";
  }
}

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
  city: z.string().optional().default(""),
  country: z.string().min(1),
  language: z.enum(REPORT_LANGUAGE_IDS).default(DEFAULT_LANGUAGE),
  currency: Currency.default("EUR"),
  heightCm: z.number().int().min(120).max(230),
  weightKg: z.number().int().min(30).max(300).optional(),
  bodyType: BodyType.optional(),
  measurements: measurementsSchema.optional(),
  // Self-reported colouring — sharpens the seasonal colour analysis (optional).
  // Accepts legacy `blonde` / `red` and maps them onto the split palette.
  hairColor: HairColorField,
  eyeColor: EyeColor.optional(),
  occupation: z.string().min(1),
  lifestyle: z.array(z.string()).default([]),
  goals: z.array(z.string()).min(1),
  boldness: Boldness,
  budgetEur: z.object({ min: z.number(), max: z.number() }),
  notes: z.string().optional(),
});
export type Intake = z.infer<typeof intakeSchema>;

/**
 * Persistent user profile — the durable defaults that seed the report wizard.
 * Stores DECLARED traits, preferences and last-used situational hints only; it
 * never stores derived appearance (undertone/contrast/faceShape/colorSeason —
 * those are re-read from the photo per report), and stores birthYear not age.
 */
export const userProfileSchema = z.object({
  country: z.string().optional(),
  city: z.string().optional(),
  currency: Currency.optional(),
  language: z.enum(REPORT_LANGUAGE_IDS).optional(),
  occupation: z.string().optional(),
  genderPresentation: GenderPresentation.optional(),
  birthYear: z.number().int().min(1900).max(2100).optional(),
  heightCm: z.number().int().min(120).max(230).optional(),
  weightKg: z.number().int().min(30).max(300).optional(),
  bodyType: BodyType.optional(),
  hairColor: HairColorField,
  eyeColor: EyeColor.optional(),
  measurements: measurementsSchema.optional(),
  goals: z.array(z.string()).optional(),
  boldness: Boldness.optional(),
  budgetEur: z.object({ min: z.number(), max: z.number() }).optional(),
  lifestyle: z.array(z.string()).optional(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * Build the durable profile from a report's intake — DECLARED fields only, never
 * derived appearance. `birthYear` is derived from the entered age and the given
 * current year so the stored profile ages correctly over time.
 */
export function profileFromIntake(intake: Intake, currentYear: number): UserProfile {
  return {
    country: intake.country,
    city: intake.city || undefined,
    currency: intake.currency,
    language: intake.language,
    occupation: intake.occupation,
    genderPresentation: intake.genderPresentation,
    birthYear: currentYear - intake.age,
    heightCm: intake.heightCm,
    weightKg: intake.weightKg,
    bodyType: intake.bodyType,
    hairColor: intake.hairColor,
    eyeColor: intake.eyeColor,
    measurements: intake.measurements,
    goals: intake.goals,
    boldness: intake.boldness,
    budgetEur: intake.budgetEur,
    lifestyle: intake.lifestyle,
  };
}

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
    hairColor: z.string().optional(),
    eyeColor: z.string().optional(),
  }),
  colorSeason: ColorSeason,
  /** 12-subseason classification (optional — older reports may lack it). */
  colorSubseason: Subseason.optional(),
  currency: Currency.default("EUR"),
  goals: z.array(z.string()),
  /** Optional lifestyle tags carried from intake — empty means no styling effect. */
  lifestyle: z.array(z.string()).default([]),
  boldness: Boldness,
  budgetEur: z.object({ min: z.number(), max: z.number() }),
});
export type StyleProfile = z.infer<typeof styleProfileSchema>;
