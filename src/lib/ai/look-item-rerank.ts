import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { LOOK_RERANK_VERSION } from "@/lib/look-match-version";
import { lookStyleRerankHint } from "@/lib/look-style-fit";
import { lookOccasionRerankHint } from "@/lib/look-occasion-fit";
import {
  formatRerankCandidate,
  type RerankCandidate,
  type RerankGarmentSlot,
} from "@/lib/ai/look-item-rerank-format";
import {
  loadOrComputeRerank,
  memoryRerankStore,
  rerankCacheKey,
  type RerankCacheStore,
} from "@/lib/ai/look-item-rerank-cache";

export type { RerankCandidate, RerankGarmentSlot };
export { LOOK_RERANK_CANDIDATE_LIMIT } from "@/lib/ai/look-item-rerank-format";

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

const memoryPicks = memoryRerankStore<RerankPick[]>();

function rerankStoragePath(key: string): string {
  return `looks/rerank/${LOOK_RERANK_VERSION}/${key}.json`;
}

function persistentRerankStore(): RerankCacheStore<RerankPick[]> {
  return {
    async get(key) {
      const hit = await memoryPicks.get(key);
      if (hit) return hit;
      if (!hasSupabaseAdmin) return null;
      try {
        const { data } = await createAdminSupabase()
          .storage.from("assets")
          .download(rerankStoragePath(key));
        if (!data) return null;
        const parsed = JSON.parse(await data.text()) as { picks?: RerankPick[] };
        if (!Array.isArray(parsed?.picks)) return null;
        await memoryPicks.set(key, parsed.picks);
        return parsed.picks;
      } catch {
        return null;
      }
    },
    async set(key, picks) {
      await memoryPicks.set(key, picks);
      if (!hasSupabaseAdmin) return;
      try {
        await createAdminSupabase()
          .storage.from("assets")
          .upload(rerankStoragePath(key), JSON.stringify({ picks, savedAt: Date.now() }), {
            contentType: "application/json",
            upsert: true,
          });
      } catch {
        // Best-effort — the next rematch just recomputes.
      }
    },
  };
}

/**
 * LLM rerank: one reasoning call per look, picking candidate indices per slot.
 * Returns null on failure so callers can fall back to heuristic ranking.
 * Cached by look copy + ordered top-8 ids + LOOK_RERANK_VERSION so a heuristic
 * rematch that does not change candidates skips Sonnet.
 */
export async function rerankLookItemSlots(
  lookTitle: string,
  lookDescription: string,
  paletteHints: string,
  slots: RerankGarmentSlot[],
  styleId?: string | null,
  occasionId?: string | null,
): Promise<RerankPick[] | null> {
  if (!slots.length) return null;

  const withCandidates = slots.filter((s) => s.candidates.length > 0);
  if (!withCandidates.length) return null;

  const key = rerankCacheKey({
    lookTitle,
    lookDescription,
    paletteHints,
    styleId,
    occasionId,
    slots: withCandidates.map((s) => ({
      slot: s.slot,
      candidateIds: s.candidates.map((c) => c.id),
    })),
  });

  return loadOrComputeRerank(
    key,
    async () => {
      if (!hasAI) return null;
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
    },
    persistentRerankStore(),
  );
}
