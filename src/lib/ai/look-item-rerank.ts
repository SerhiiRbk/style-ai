import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";

/** Max vector candidates passed to the reranker per garment slot. */
export const LOOK_RERANK_CANDIDATE_LIMIT = 8;

export type RerankCandidate = {
  id: string;
  brand: string | null;
  title: string;
  color: string | null;
  priceEur: number | null;
  category: string;
};

export type RerankGarmentSlot = {
  slot: number;
  category: string;
  garment: string;
  color: string | null;
  clause: string;
  candidates: RerankCandidate[];
};

export type RerankPick = {
  slot: number;
  candidateIndex: number;
  similarPick: boolean;
};

const lookItemRerankSchema = z.object({
  picks: z.array(
    z.object({
      slot: z.number().int().min(0),
      candidateIndex: z.number().int(),
      similarPick: z.boolean(),
    }),
  ),
});

function formatCandidate(idx: number, c: RerankCandidate): string {
  const brand = c.brand ? `${c.brand} ` : "";
  const price =
    c.priceEur != null && Number.isFinite(c.priceEur)
      ? ` · €${Math.round(c.priceEur)}`
      : "";
  const color = c.color?.trim() ? ` · colour ${c.color}` : "";
  return `[${idx}] ${brand}${c.title}${color}${price}`;
}

function buildRerankPrompt(
  lookTitle: string,
  lookDescription: string,
  paletteHints: string,
  slots: RerankGarmentSlot[],
): string {
  const slotBlocks = slots
    .map((s) => {
      const target = [s.color, s.garment].filter(Boolean).join(" ");
      const list =
        s.candidates.length > 0
          ? s.candidates.map((c, i) => formatCandidate(i, c)).join("\n")
          : "(no catalogue candidates)";
      return (
        `Slot ${s.slot} — ${s.category}\n` +
        `Target garment: ${target || s.garment}\n` +
        `From look: ${s.clause || lookDescription}\n` +
        `Candidates:\n${list}`
      );
    })
    .join("\n\n");

  return (
    `You are a menswear stylist picking real catalogue products for ONE outfit look.\n\n` +
    `Look title: ${lookTitle}\n` +
    `Look description: ${lookDescription}\n` +
    (paletteHints ? `Palette hints: ${paletteHints}\n` : "") +
    `\nFor each slot, choose the single best candidate index that matches the ` +
    `garment TYPE (e.g. chinos not jeans, crewneck not blazer), COLOUR family, and ` +
    `formality of this look. Use -1 only when every candidate is clearly wrong ` +
    `(wrong category, clashing colour, or unrelated item).\n` +
    `Set similarPick=true when the pick is the closest available option but not a ` +
    `strong colour or style match.\n\n` +
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
      });
    }
    return [...valid.values()];
  } catch (err) {
    console.error("[look-item-rerank]", err);
    return null;
  }
}
