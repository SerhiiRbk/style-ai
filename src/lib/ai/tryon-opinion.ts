import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import { captureWarning } from "@/lib/observability";
import type { StyleProfile } from "@/lib/style-profile";

/** One tried-on garment, as passed to Carlo for a verdict. */
export type OpinionGarment = {
  title: string;
  category: string;
  color?: string | null;
};

export type TryOnVerdict = "great" | "good" | "caution";

export type TryOnOpinion = {
  /** Fit for THIS person (or general when no profile): great | good | caution. */
  verdict: TryOnVerdict;
  /** One short headline line. */
  headline: string;
  /** 2–3 sentences in Carlo's voice: why it works / where it falls short. */
  body: string;
  /** 2–3 short suggestions of what to add to complete the look. */
  pairWith: string[];
};

const opinionSchema = z.object({
  verdict: z.enum(["great", "good", "caution"]),
  headline: z.string().min(6).max(90),
  body: z.string().min(40).max(600),
  pairWith: z.array(z.string().min(3).max(90)).min(1).max(3),
});

function profileBrief(profile: StyleProfile): string {
  const p = profile.physical;
  const season = profile.colorSubseason
    ? profile.colorSubseason.replace("-", " ")
    : profile.colorSeason;
  const parts = [
    `${season} colouring`,
    `${p.undertone} undertone`,
    `${p.contrast} contrast`,
    `${p.bodyType} build`,
    p.faceShape ? `${p.faceShape} face` : null,
    profile.goals?.length ? `goals: ${profile.goals.join(", ")}` : null,
    `boldness: ${profile.boldness}`,
    profile.demographics?.climate
      ? `climate: ${profile.demographics.climate}`
      : null,
  ].filter(Boolean);
  return parts.join("; ") + ".";
}

function garmentLines(garments: OpinionGarment[]): string {
  return garments
    .map((g) => {
      const color = g.color?.trim() ? `${g.color} ` : "";
      return `- ${color}${g.title} (${g.category})`;
    })
    .join("\n");
}

function buildPrompt(
  garments: OpinionGarment[],
  profile: StyleProfile | null,
): string {
  const isOutfit = garments.length > 1;
  const subject = isOutfit ? "this outfit" : "this piece";
  const clientBlock = profile
    ? `The client's style profile: ${profileBrief(profile)}\n\n` +
      `Judge whether ${subject} genuinely suits THIS client — reference their ` +
      `palette/season, undertone, contrast, build or goals as the reason.\n`
    : `You don't have this client's style profile yet, so give calm, general ` +
      `menswear guidance on ${subject} and note that a Valetti report would ` +
      `tailor this to their colouring and build. Do not invent their attributes.\n`;

  return (
    `You are Carlo Valetti, a calm, precise personal stylist. A client has just ` +
    `virtually tried on ${subject}. Give your honest expert read.\n\n` +
    clientBlock +
    `\n${isOutfit ? "Items" : "Item"}:\n${garmentLines(garments)}\n\n` +
    `Rules:\n` +
    `- verdict: "great" (a strong match), "good" (works, with a caveat), or ` +
    `"caution" (wearable but not ideal for them).\n` +
    `- headline: one short line summarising the verdict.\n` +
    `- body: 2–3 calm sentences — why it works or where it falls short. Be honest; ` +
    `a "caution" is more useful than empty praise. No hype words.\n` +
    `- Never claim a fabric/material for the tried-on item unless the word is in ` +
    `its title.\n` +
    `- pairWith: 2–3 concrete pieces that would complete the look (these MAY name ` +
    `materials/colours, since they are things to add).\n` +
    `- Write in English.`
  );
}

function normalizeOpinion(output: z.infer<typeof opinionSchema>): TryOnOpinion {
  return {
    verdict: output.verdict,
    headline: output.headline.trim(),
    body: output.body.trim(),
    pairWith: output.pairWith.map((s) => s.trim()).filter(Boolean),
  };
}

/**
 * Carlo's expert read on a catalogue try-on. Returns null when AI is
 * unconfigured or the call fails, so the try-on result still renders without it.
 * `profile` null → general (non-personalised) guidance.
 */
export async function generateTryOnOpinion(opts: {
  garments: OpinionGarment[];
  profile: StyleProfile | null;
}): Promise<TryOnOpinion | null> {
  const { garments, profile } = opts;
  if (!hasAI || !garments.length) return null;
  try {
    const { output } = await generateText({
      model: env.modelReasoning,
      output: Output.object({ schema: opinionSchema }),
      prompt: buildPrompt(garments, profile),
    });
    return normalizeOpinion(output);
  } catch (err) {
    captureWarning("[tryon-opinion] generation failed", {
      error: err instanceof Error ? err.message : String(err),
      garments: garments.map((g) => g.title),
    });
    return null;
  }
}

function buildConstructPrompt(opts: {
  title: string;
  description: string;
  garments: OpinionGarment[];
  profile: StyleProfile | null;
  occasionLabel?: string | null;
}): string {
  const { title, description, garments, profile, occasionLabel } = opts;
  const clientBlock = profile
    ? `The client's style profile: ${profileBrief(profile)}\n\n` +
      `Judge whether this constructed outfit genuinely suits THIS client — ` +
      `reference their palette/season, undertone, contrast, build or goals as ` +
      `the reason.\n`
    : `You don't have this client's style profile yet, so give calm, general ` +
      `menswear guidance on this constructed outfit and note that a Valetti ` +
      `report would tailor this to their colouring and build. Do not invent ` +
      `their attributes.\n`;

  const header = [
    occasionLabel?.trim() ? `Occasion: ${occasionLabel.trim()}.` : null,
    title.trim() ? `Look title: ${title.trim()}.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    `You are Carlo Valetti, a calm, precise personal stylist. The client rebuilt ` +
    `this look in the constructor — it is not your original recommendation. ` +
    `Give your honest expert estimate of the constructed outfit as they would ` +
    `wear it.\n\n` +
    (header ? `${header}\n\n` : "") +
    (description.trim() ? `Brief they built:\n${description.trim()}\n\n` : "") +
    clientBlock +
    `\nPieces now in the look:\n${garmentLines(garments)}\n\n` +
    `Rules:\n` +
    `- Judge the constructed combination, not any earlier look you may have written.\n` +
    `- verdict: "great" (a strong match), "good" (works, with a caveat), or ` +
    `"caution" (wearable but not ideal for them).\n` +
    `- headline: one short line summarising the verdict.\n` +
    `- body: 2–3 calm sentences — why it works or where it falls short. Be honest; ` +
    `a "caution" is more useful than empty praise. No hype words.\n` +
    `- Never claim a fabric/material unless the word is in a piece title or the brief.\n` +
    `- pairWith: 2–3 concrete pieces that would complete or refine the look ` +
    `(these MAY name materials/colours, since they are things to add).\n` +
    `- Write in English.`
  );
}

/**
 * Carlo's estimate of a constructor-rebuilt look. Same schema as a try-on
 * verdict. Returns null when AI is unconfigured or the call fails.
 */
export async function generateConstructedLookOpinion(opts: {
  title: string;
  description: string;
  garments: OpinionGarment[];
  profile: StyleProfile | null;
  occasionLabel?: string | null;
}): Promise<TryOnOpinion | null> {
  const garments = opts.garments.length
    ? opts.garments
    : [
        {
          title: opts.description.trim() || opts.title.trim() || "Constructed look",
          category: "Look",
        },
      ];
  if (!hasAI) return null;
  try {
    const { output } = await generateText({
      model: env.modelReasoning,
      output: Output.object({ schema: opinionSchema }),
      prompt: buildConstructPrompt({ ...opts, garments }),
    });
    return normalizeOpinion(output);
  } catch (err) {
    captureWarning("[look-estimate] generation failed", {
      error: err instanceof Error ? err.message : String(err),
      title: opts.title,
    });
    return null;
  }
}
