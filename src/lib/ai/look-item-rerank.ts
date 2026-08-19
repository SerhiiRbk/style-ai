import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import { lookStyleRerankHint } from "@/lib/look-style-fit";
import { lookOccasionRerankHint } from "@/lib/look-occasion-fit";

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
  styleId?: string | null,
  occasionId?: string | null,
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

  const styleHint = lookStyleRerankHint(styleId);
  const occasionHint = lookOccasionRerankHint(occasionId);
  return (
    `You are a menswear stylist picking real catalogue products for ONE outfit look.\n\n` +
    `Look title: ${lookTitle}\n` +
    `Look description: ${lookDescription}\n` +
    (paletteHints ? `Palette hints: ${paletteHints}\n` : "") +
    (styleHint ? `${styleHint}\n` : "") +
    (occasionHint ? `${occasionHint}\n` : "") +
    `\nFor each slot, choose the single best candidate index that matches the ` +
    `garment TYPE (e.g. chinos not jeans, blazer not knit/zip sport jacket, ` +
    `crewneck not blazer), COLOUR shade within the family (medium grey not light ` +
    `grey or charcoal), and formality of this look. Use -1 only when every ` +
    `candidate is clearly wrong (wrong category, clashing colour, or unrelated ` +
    `item). Never substitute a different accessory type: a pocket square is not ` +
    `a tie, a "tie with pocket square" set, a cap, a hat, or a belt. If no ` +
    `candidate is the named accessory, use -1.\n` +
    `Outfit-level colour: do NOT pair a shirt and trousers in the same chromatic ` +
    `family (green, red, orange, yellow, pink, purple) unless the look description ` +
    `itself names that family on BOTH pieces. Sage + olive is a clash. Teal is ` +
    `blue, not green — a sage shirt wants teal, navy, stone, or cream trousers, ` +
    `not another green. Navy-on-navy and neutrals (grey, brown, black, white) are ` +
    `fine.\n` +
    `A missing exact colour may be filled by a close neighbour (dusty rose → ` +
    `muted pink or lilac; greige → beige/dove; sage → khaki; mushroom → taupe; ` +
    `soft plum → mauve/lilac — never a neon or a navy stand-in). Mark those similarPick=true.\n` +
    `Nude, champagne, camel and sand are warm beige — never a dusty-rose or ` +
    `pink stand-in. If a pink or rose candidate exists, pick it over beige.\n` +
    `Set similarPick=true when the pick is the closest available option but not a ` +
    `strong colour or style match.\n` +
    `For every pick with candidateIndex >= 0 also write "why" — ONE calm sentence ` +
    `(18–28 words) in the voice of a personal stylist: why this piece works for ` +
    `this look. Reference the item's actual type and colour; NEVER mention a ` +
    `material that is not in the candidate's title; no hype words; never write ` +
    `internal tokens such as "similarPick" in the prose.\n\n` +
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
