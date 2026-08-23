import {
  classifySubseason,
  refineSeasonForClarity,
  SUBSEASON_LABELS,
  HAIR_COLOR_LABELS,
  EYE_COLOR_LABELS,
  type HairColorId,
  type EyeColorId,
} from "@/lib/style-profile";
import {
  paletteForPerson,
  carloNoteFor,
  type ColourAnalysisResult,
  type Undertone,
  type Contrast,
  type Season,
} from "@/lib/colour-palette";

/**
 * No-photo second entry (§5.2 п.9). Five self-report answers are mapped onto the
 * same axes the vision path produces, then fed to the existing deterministic
 * {@link classifySubseason}. There is NO AI call — the quiz costs nothing and
 * relieves the A0 daily cap. The result is explicitly *preliminary*: self-report
 * of undertone is unreliable, which is why colour analysis exists as a service.
 */

export type QuizUndertone = "warm" | "cool" | "neutral";
export type QuizSun = "burn" | "gradual" | "deep";
/** Chroma self-report. "unsure" → no signal (skip the clarity refinement). */
export type QuizClarity = "muted" | "clear" | "unsure";

export type QuizAnswers = {
  undertone: QuizUndertone;
  hair: HairColorId;
  eye: EyeColorId;
  sun: QuizSun;
  contrast: Contrast;
  clarity: QuizClarity;
};

export type QuizOption = { value: string; label: string };
export type QuizQuestion = {
  id: keyof QuizAnswers;
  prompt: string;
  help?: string;
  options: QuizOption[];
};

const colourOptions = <T extends string>(
  labels: Record<T, string>,
): QuizOption[] =>
  (Object.keys(labels) as T[])
    .filter((k) => k !== "other")
    .map((k) => ({ value: k, label: labels[k] }));

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "undertone",
    prompt: "Which metal looks better against your skin?",
    help: "Hold gold, then silver, near your face in daylight.",
    options: [
      { value: "warm", label: "Gold" },
      { value: "cool", label: "Silver" },
      { value: "neutral", label: "Both / can't tell" },
    ],
  },
  {
    id: "hair",
    prompt: "Your natural hair colour",
    options: colourOptions<HairColorId>(HAIR_COLOR_LABELS),
  },
  {
    id: "eye",
    prompt: "Your eye colour",
    options: colourOptions<EyeColorId>(EYE_COLOR_LABELS),
  },
  {
    id: "sun",
    prompt: "In strong sun, your skin usually…",
    options: [
      { value: "burn", label: "Burns, rarely tans" },
      { value: "gradual", label: "Tans gradually" },
      { value: "deep", label: "Tans deeply, rarely burns" },
    ],
  },
  {
    id: "contrast",
    prompt: "How strong is the jump between hair, skin and eyes?",
    help: "Squint in a mirror — do they blend or stand apart?",
    options: [
      { value: "low", label: "Soft / blended" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "Sharp / high contrast" },
    ],
  },
  {
    // Chroma, NOT light/dark. This is a different axis from contrast above:
    // someone can be high-contrast (dark hair, fair skin) yet still muted.
    id: "clarity",
    prompt: "Are your colours soft and muted, or bright and clear?",
    help: "Not light-vs-dark — the intensity. Do your skin, hair and eyes look dusty and soft, or vivid and saturated?",
    options: [
      { value: "muted", label: "Soft / dusty / muted" },
      { value: "clear", label: "Bright / vivid / clear" },
      { value: "unsure", label: "Not sure" },
    ],
  },
];

const SKIN_TONE: Record<QuizSun, string> = {
  burn: "fair",
  gradual: "medium",
  deep: "deep",
};

/**
 * Deep colouring — dark hair AND dark eyes — reads as LOW feature-contrast yet
 * high overall depth (a "Deep" season). `contrast` cannot capture this because,
 * for dark skin, contrast-between-features and depth-of-colouring decouple. So
 * we detect depth from hair+eye directly (mirroring {@link depthFromColouring}
 * in style-profile) and let it override the contrast-based lightness below —
 * otherwise a cool, deep-skinned person who honestly reports "low contrast" is
 * misrouted to Summer instead of Deep Winter.
 */
function isDeepColouring(a: QuizAnswers): boolean {
  const darkHair = a.hair === "black" || a.hair === "dark-brown";
  const darkEye = a.eye === "brown" || a.eye === "amber";
  return darkHair && darkEye;
}

/** Coarse lightness from sun reaction + contrast — the season-routing signal. */
function lightnessOf(
  sun: QuizSun,
  contrast: Contrast,
  deepColouring: boolean,
): "light" | "medium" | "deep" {
  // Dark hair + dark eyes → deep, regardless of self-reported contrast. This is
  // the inclusivity fix: it stops "everything is dark, so low contrast" from
  // capping deep-skinned users at "medium" and steering them off Deep seasons.
  if (deepColouring && sun !== "burn") return "deep";
  if (sun === "burn") return contrast === "high" ? "medium" : "light";
  if (sun === "deep") return contrast === "low" ? "medium" : "deep";
  return contrast === "high" ? "deep" : contrast === "low" ? "light" : "medium";
}

/**
 * Base 4-season from undertone + lightness. Neutral undertone is split by sun
 * behaviour (burns → cool-leaning, tans → warm-leaning). {@link classifySubseason}
 * then refines to one of the 12 using hair/eye/contrast.
 */
function seasonFromQuiz(a: QuizAnswers): Season {
  const warm =
    a.undertone === "warm" || (a.undertone === "neutral" && a.sun !== "burn");
  const deep = isDeepColouring(a);
  const l = lightnessOf(a.sun, a.contrast, deep);
  if (warm) {
    if (l === "deep") return "autumn";
    if (l === "light" || a.contrast === "high") return "spring";
    return "autumn";
  }
  // Cool + deep colouring → Winter (→ deep-winter downstream), even when the
  // person reports low feature-contrast (dark hair/skin/eyes blend).
  if (l === "deep" || a.contrast === "high") return "winter";
  if (l === "light") return "summer";
  return "summer";
}

/** Build the same {@link ColourAnalysisResult} shape the vision path returns. */
export function quizToResult(a: QuizAnswers): ColourAnalysisResult {
  const undertone: Undertone = a.undertone;
  const contrast: Contrast = a.contrast;
  // "unsure" → no chroma signal, so the refinement is skipped (old behaviour).
  const clarity = a.clarity === "unsure" ? undefined : a.clarity;
  // Same chroma correction as the photo path (refineSeasonForClarity): a muted
  // cool/neutral person read as "winter" from value-contrast alone is really a
  // Summer. Keeps the quiz and /colours photo entry in lockstep.
  const season = refineSeasonForClarity({
    season: seasonFromQuiz(a),
    undertone,
    clarity,
  });
  const subseason = classifySubseason({
    season,
    undertone,
    contrast,
    clarity,
    hairColor: a.hair,
    eyeColor: a.eye,
  });
  const subseasonLabel = SUBSEASON_LABELS[subseason];
  return {
    season,
    subseason,
    subseasonLabel,
    undertone,
    contrast,
    skinTone: SKIN_TONE[a.sun],
    hairColor: HAIR_COLOR_LABELS[a.hair],
    eyeColor: EYE_COLOR_LABELS[a.eye],
    palette: paletteForPerson(subseason, {
      undertone,
      contrast,
      hairColor: HAIR_COLOR_LABELS[a.hair],
      eyeColor: EYE_COLOR_LABELS[a.eye],
      skinTone: SKIN_TONE[a.sun],
    }),
    carloNote: carloNoteFor({ season, subseasonLabel, undertone, contrast }),
  };
}
