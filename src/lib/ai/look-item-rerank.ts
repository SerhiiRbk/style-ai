import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import { lookStyleRerankHint } from "@/lib/look-style-fit";
import { lookOccasionRerankHint } from "@/lib/look-occasion-fit";
import {
  formatRerankCandidate,
  type RerankCandidate,
  type RerankGarmentSlot,
} from "@/lib/ai/look-item-rerank-format";

export type { RerankCandidate, RerankGarmentSlot };

/** Max vector candidates passed to the reranker per garment slot. */
export const LOOK_RERANK_CANDIDATE_LIMIT = 8;

export type RerankPick = {
  slot: number;
  candidateIndex: number;
  similarPick: boolean;
  /** One-sentence stylist reason for the pick — validated by the caller before use. */
  why?: string;
};

const lookItemRerankSchema = z.object({
  picks: z.array(
    z.object({
      slot: z.number().int().min(0),
      candidateIndex: z.number().int(),
      similarPick: z.boolean(),
      why: z.string().min(20).max(300).optional(),
    }),
  ),
});

function buildRerankPrompt(
  lookTitle: string,
  lookDescription: string,
  paletteHints: string,
  slots: RerankGarmentSlot[],
  styleId?: string | null,
  occasionId?: string | null,
): string {
  const slotBlocks = slots
    .map((s) => {
      const target = [s.color, s.garment].filter(Boolean).join(" ");
      const list =
        s.candidates.length > 0
          ? s.candidates.map((c, i) => formatRerankCandidate(i, c)).join("\n")
          : "(no catalogue candidates)";
      return (
        `Slot ${s.slot} — ${s.category}\n` +
        `Target garment: ${target || s.garment}\n` +
        `From look: ${s.clause || lookDescription}\n` +
        `Candidates:\n${list}`
      );
    })
    .join("\n\n");

  const styleHint = lookStyleRerankHint(styleId);
  const occasionHint = lookOccasionRerankHint(occasionId);
  return (
    `You are a menswear stylist picking real catalogue products for ONE outfit look.\n\n` +
    `Look title: ${lookTitle}\n` +
    `Look description: ${lookDescription}\n` +
    (paletteHints ? `Palette hints: ${paletteHints}\n` : "") +
    (styleHint ? `${styleHint}\n` : "") +
    (occasionHint ? `${occasionHint}\n` : "") +
    `\nEach candidate lists typed tokens (subtype / material / fit / pattern). ` +
    `Trust those over guessing from the title: shirt ≠ tee, blazer ≠ knit, ` +
    `suede ≠ leather, chinos ≠ wool trousers, loafers ≠ derbies.\n` +
    `For each slot pick the single best index for garment type, colour shade, ` +
    `and formality. Use -1 only when every candidate is the wrong type or a ` +
    `clashing colour. Do not swap accessory types (square ≠ tie, messenger ≠ ` +
    `crossbody ≠ weekender).\n` +
    `Outfit colour: do not put shirt and trousers in the same chromatic family ` +
    `(green, red, orange, yellow, pink, purple) unless the look names that ` +
    `family on BOTH. Neutrals and navy-on-navy are fine. Brown-family trousers ` +
    `are not black. Belt and shoe leather follow the trouser tone.\n` +
    `A close colour neighbour (dusty rose → muted pink) is allowed — ` +
    `similarPick=true. Nude, camel and sand are not pink.\n` +
    `similarPick=true when the pick is closest available but not a strong match.\n` +
    `For every pick with candidateIndex >= 0 write "why" — ONE calm sentence ` +
    `(18–28 words). Use the candidate's listed type, colour and attributes; ` +
    `never invent a material that is not on the line; no hype; no internal tokens.\n\n` +
    slotBlocks
  );
}

/**
 * LLM rerank: one reasoning call per look, picking candidate indices per slot.
 * Returns null on failure so callers can fall back to heuristic ranking.
 */
export async function rerankLookItemSlots(
  lookTitle: string,
  lookDescription: string,
  paletteHints: string,
  slots: RerankGarmentSlot[],
  styleId?: string | null,
  occasionId?: string | null,
): Promise<RerankPick[] | null> {
  if (!hasAI || !slots.length) return null;

  const withCandidates = slots.filter((s) => s.candidates.length > 0);
  if (!withCandidates.length) return null;

  try {
    const { output } = await generateText({
      model: env.modelReasoning,
      output: Output.object({ schema: lookItemRerankSchema }),
      prompt: buildRerankPrompt(
        lookTitle,
        lookDescription,
        paletteHints,
        withCandidates,
        styleId,
        occasionId,
      ),
    });

    const valid = new Map<number, RerankPick>();
    for (const pick of output.picks) {
      const slot = withCandidates.find((s) => s.slot === pick.slot);
      if (!slot) continue;
      const max = slot.candidates.length - 1;
      if (pick.candidateIndex < -1 || pick.candidateIndex > max) continue;
      valid.set(pick.slot, {
        slot: pick.slot,
        candidateIndex: pick.candidateIndex,
        similarPick: pick.similarPick,
        why: pick.why,
      });
    }
    return [...valid.values()];
  } catch (err) {
    console.error("[look-item-rerank]", err);
    return null;
  }
}
