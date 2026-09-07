import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env, hasAI } from "@/lib/env";
import { captureWarning } from "@/lib/observability";
import { isUnknownSwatchHex, pickHero } from "@/lib/style-extras";
import type { ShoppingItem } from "@/lib/report";
import type { StyleProfile } from "@/lib/style-profile";
import type { AvoidSwatch } from "@/lib/style-extras";
// The deterministic guard lives in a dependency-light module (no "server-only")
// so node:test can import it; re-exported here for existing callers.
import { reasonIsSafe } from "@/lib/shopping-reason-guard";

export { reasonIsSafe } from "@/lib/shopping-reason-guard";

/** Bumped when the reasons prompt/guard change — lets a backfill target stale copy. */
export const REASON_VERSION = 3;


const shoppingReasonsSchema = z.object({
  reasons: z.array(
    z.object({
      index: z.number().int().min(0),
      why: z.string().min(20).max(300),
    }),
  ),
  /** Investment-framed reason for the item marked (hero) — see prompt rules. */
  heroWhy: z.string().min(20).max(300).optional(),
});

function profileBrief(profile: StyleProfile): string {
  const p = profile.physical;
  const season = profile.colorSubseason
    ? profile.colorSubseason.replace("-", " ")
    : profile.colorSeason;
  return (
    `${season} colouring, ${p.undertone} undertone, ${p.contrast} contrast, ` +
    `${p.bodyType} build; goals: ${profile.goals.join(", ")}; ` +
    `boldness: ${profile.boldness}.`
  );
}

function formatItem(i: number, item: ShoppingItem, heroIndex: number): string {
  const price =
    item.priceEur && Number.isFinite(item.priceEur)
      ? ` · €${Math.round(item.priceEur)}`
      : "";
  const similar = item.similarPick ? " [closest match, not exact]" : "";
  const hero = i === heroIndex ? " [hero]" : "";
  // A placeholder swatch is not "light grey" — the model must not name a colour
  // the feed never stated (it wrote "light grey blazer" about a beige one).
  const colour = isUnknownSwatchHex(item.color)
    ? item.colorName
      ? `colour ${item.colorName}`
      : "colour not stated by the retailer (do not name a colour)"
    : `colour swatch ${item.color}${item.colorName ? ` (${item.colorName})` : ""}`;
  return `[${i}] ${item.category} — ${item.title} · ${colour}${price}${similar}${hero}`;
}

function buildReasonsPrompt(
  items: ShoppingItem[],
  profile: StyleProfile,
  heroIndex: number,
  avoid: AvoidSwatch[] = [],
): string {
  const heroRule =
    heroIndex >= 0
      ? `- Item [${heroIndex}] is marked [hero] — the single "invest in this" piece the ` +
        `report leads with. Its per-item reason follows the normal rules; ADDITIONALLY ` +
        `fill the top-level "heroWhy" field for it with a DIFFERENT sentence in an ` +
        `investment frame — durability, cost-per-wear, or how one strong piece lifts ` +
        `everything else the client owns. Same material rule applies.\n`
      : "";
  return (
    `You are Carlo Valetti, a calm and precise personal stylist, writing the ` +
    `one-line "why this piece" note for each item on a client's shopping list.\n\n` +
    `Client: ${profileBrief(profile)}\n\n` +
    `Rules:\n` +
    `- Exactly ONE sentence per item, 18–28 words, calm and specific. No hype ` +
    `words (perfect, amazing, stunning, must-have).\n` +
    `- Reference the actual item — its type and, when helpful, its colour. ` +
    `Interpret the hex swatch as a colour name.\n` +
    `- NEVER mention a material (leather, wool, linen, suede, cashmere…) unless ` +
    `that word appears in the item's own title.\n` +
    `- Tie each reason to ONE profile anchor (palette/season, undertone, ` +
    `contrast, build, or a goal); vary the anchors — no anchor on more than ` +
    `three items.\n` +
    (avoid.length
      ? `- Colours to avoid for clothing near the face: ${avoid.map((c) => c.name).filter(Boolean).join(", ")}. ` +
        `Do not sell those as palette picks. Black or brown derbies, oxfords, loafers ` +
        `and belts may be framed as classic business etiquette, never as a seasonal colour.\n`
      : "") +
    `- An item tagged [closest match, not exact] is the nearest catalogue option, ` +
    `not a perfect one — acknowledge that honestly in plain words (e.g. "the ` +
    `closest match in your palette"). NEVER write bracketed tags or code-like ` +
    `tokens (no "[hero]", no "similarPick") in the prose.\n` +
    heroRule +
    `- Write in English. Return a reason for every index.\n\n` +
    `Items:\n${items.map((it, i) => formatItem(i, it, heroIndex)).join("\n")}`
  );
}

export type ShoppingReasons = {
  /** index → per-item "why" that passed the safety guard. */
  byIndex: Map<number, string>;
  /** Index of the hero piece the prompt was built around (-1 when none). */
  heroIndex: number;
  /** Investment-framed hero reason, when produced and safe. */
  heroWhy: string | null;
};

/**
 * One batched reasoning call for the whole shopping list. The hero piece (same
 * deterministic `pickHero` used by the "Start here" block) additionally gets an
 * investment-framed `heroWhy`, so the "Invest in your hero piece" copy isn't a
 * reused fit-framed sentence. Returns null when the call fails outright.
 */
export async function generateShoppingReasons(
  items: ShoppingItem[],
  profile: StyleProfile,
  avoid: AvoidSwatch[] = [],
): Promise<ShoppingReasons | null> {
  if (!hasAI || !items.length) return null;
  const hero = pickHero(items, profile.boldness);
  const heroIndex = hero ? items.indexOf(hero) : -1;
  try {
    const { output } = await generateText({
      model: env.modelReasoning,
      output: Output.object({ schema: shoppingReasonsSchema }),
      prompt: buildReasonsPrompt(items, profile, heroIndex, avoid),
    });
    const byIndex = new Map<number, string>();
    for (const r of output.reasons) {
      const item = items[r.index];
      if (!item || byIndex.has(r.index)) continue;
      if (!reasonIsSafe(r.why, item, avoid)) {
        captureWarning(
          "[shopping-reasons] reason failed safety guard — keeping template",
          { index: r.index, title: item.title, why: r.why },
        );
        continue;
      }
      byIndex.set(r.index, r.why.trim());
    }
    let heroWhy: string | null = null;
    const heroItem = heroIndex >= 0 ? items[heroIndex] : undefined;
    if (output.heroWhy && heroItem) {
      if (reasonIsSafe(output.heroWhy, heroItem, avoid)) {
        heroWhy = output.heroWhy.trim();
      } else {
        captureWarning(
          "[shopping-reasons] heroWhy failed safety guard — keeping template",
          { title: heroItem.title, why: output.heroWhy },
        );
      }
    }
    return { byIndex, heroIndex, heroWhy };
  } catch (err) {
    captureWarning(
      "[shopping-reasons] generation failed — keeping template copy",
      { error: err instanceof Error ? err.message : String(err) },
    );
    return null;
  }
}

/**
 * Replace template "why" copy with item-aware reasons where the model produced
 * a safe one, and attach the investment-framed `heroWhy` to the hero piece.
 * Never throws and never drops items — on any failure the input is returned
 * unchanged, so it can sit inline on the matching path.
 */
export async function applyShoppingReasons(
  items: ShoppingItem[],
  profile: StyleProfile,
  avoid: AvoidSwatch[] = [],
): Promise<ShoppingItem[]> {
  if (!env.shoppingReasonsLLM || !hasAI || !items.length) return items;
  const res = await generateShoppingReasons(items, profile, avoid);
  if (!res || (!res.byIndex.size && !res.heroWhy)) return items;
  return items.map((item, i) => {
    const why = res.byIndex.get(i);
    const isHero = i === res.heroIndex && res.heroWhy;
    if (!why && !isHero) return item;
    return {
      ...item,
      ...(why ? { why, reasonVersion: REASON_VERSION } : {}),
      ...(isHero ? { heroWhy: res.heroWhy! } : {}),
    };
  });
}
