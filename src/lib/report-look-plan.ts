import { LOOK_CONTEXTS, type LookContext } from "@/lib/look-contexts";
import type { Intake, StyleProfile } from "@/lib/style-profile";

/**
 * Deterministic occasion plan for a report's looks. The reasoning model used
 * to pick contexts itself ("work, smart-casual, weekend") and the set could
 * converge on one silhouette; now the contexts are derived from what the
 * client actually told us (occupation, goals, lifestyle) and passed in, so a
 * speaker gets a stage look, a dating goal gets a dinner look, and every look
 * carries a canonical `context` string that `lookOccasionIdFromContext`
 * resolves exactly.
 */
const BASELINE_ORDER = [
  "smart_casual",
  "work",
  "weekend",
  "dinner",
  "business_social",
  "travel",
  "cultural",
  "formal",
  "party",
  "outdoor",
  "resort",
  "wedding_guest",
] as const;

type Signal = { re: RegExp; ids: string[] };

/** Signal → occasions it pulls forward (first match wins the earlier slot). */
const SIGNALS: Signal[] = [
  { re: /dating|date|romance|partner|attract/i, ids: ["dinner", "weekend"] },
  { re: /speak|stage|conference|keynote|present|pitch|public/i, ids: ["business_social", "work"] },
  { re: /creator|content|studio|shoot|camera|blog|youtube|influenc/i, ids: ["cultural", "smart_casual"] },
  { re: /law|legal|finance|bank|consult|corporate|executive|director|manager|office|meeting|client/i, ids: ["work", "business_social"] },
  { re: /wedding/i, ids: ["wedding_guest"] },
  { re: /travel|trip|flight|nomad|commute/i, ids: ["travel"] },
  { re: /party|night ?out|club|festival|evening|cocktail/i, ids: ["party", "dinner"] },
  { re: /gallery|theatre|theater|museum|culture|art|concert|dinner reservation/i, ids: ["cultural"] },
  { re: /gala|black tie|formal|ceremony|award/i, ids: ["formal"] },
  { re: /hik|outdoor|cycl|run|gym|sport|active|trail|sail/i, ids: ["outdoor", "weekend"] },
  { re: /beach|resort|holiday|vacation|mediterranean|riviera|yacht/i, ids: ["resort"] },
  { re: /remote|freelance|casual|relaxed|weekend|family|kids|parent/i, ids: ["weekend", "smart_casual"] },
];

export function planReportLookContexts(
  profile: Pick<StyleProfile, "goals" | "lifestyle" | "occupation">,
  intake: Pick<Intake, "goals" | "lifestyle" | "occupation"> | null | undefined,
  count: number,
): LookContext[] {
  if (count <= 0) return [];
  const hay = [
    profile.occupation ?? intake?.occupation ?? "",
    ...(profile.goals ?? intake?.goals ?? []),
    ...(profile.lifestyle ?? intake?.lifestyle ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const ordered: string[] = [];
  const push = (id: string) => {
    if (!ordered.includes(id) && LOOK_CONTEXTS.some((c) => c.id === id)) ordered.push(id);
  };
  // A one-look (free) report is always the most versatile occasion.
  if (count === 1) push("smart_casual");
  for (const s of SIGNALS) if (s.re.test(hay)) s.ids.forEach(push);
  // Every multi-look report keeps one relaxed and one polished anchor so the
  // set spans the week even when the signals all point one way.
  if (count >= 3) {
    push("smart_casual");
    push(/work|business_social/.test(ordered.join(" ")) ? "weekend" : "work");
    push("weekend");
  }
  for (const id of BASELINE_ORDER) push(id);
  return ordered
    .slice(0, count)
    .map((id) => LOOK_CONTEXTS.find((c) => c.id === id)!)
    .filter(Boolean);
}
