import {
  classifySubseason,
  SUBSEASON_LABELS,
  HAIR_COLOR_LABELS,
  EYE_COLOR_LABELS,
  type HairColorId,
  type EyeColorId,
} from "@/lib/style-profile";
import {
  paletteForSubseason,
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

export type QuizAnswers = {
  undertone: QuizUndertone;
  hair: HairColorId;
  eye: EyeColorId;
  sun: QuizSun;
  contrast: Contrast;
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
];

const SKIN_TONE: Record<QuizSun, string> = {
  burn: "fair",
  gradual: "medium",
  deep: "deep",
};

/** Coarse lightness from sun reaction + contrast — the season-routing signal. */
function lightnessOf(sun: QuizSun, contrast: Contrast): "light" | "medium" | "deep" {
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
  const l = lightnessOf(a.sun, a.contrast);
  if (warm) {
    if (l === "deep") return "autumn";
    if (l === "light" || a.contrast === "high") return "spring";
    return "autumn";
  }
  if (l === "light") return "summer";
  if (l === "deep" || a.contrast === "high") return "winter";
  return "summer";
}

/** Build the same {@link ColourAnalysisResult} shape the vision path returns. */
export function quizToResult(a: QuizAnswers): ColourAnalysisResult {
  const undertone: Undertone = a.undertone;
  const contrast: Contrast = a.contrast;
  const season = seasonFromQuiz(a);
  const subseason = classifySubseason({
    season,
    undertone,
    contrast,
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
    palette: paletteForSubseason(subseason),
    carloNote: carloNoteFor({ season, subseasonLabel, undertone, contrast }),
  };
}
