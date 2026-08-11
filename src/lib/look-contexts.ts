/**
 * Occasion presets for the standalone "generate one more look" add-on.
 * Pure data — safe to import from both client (selector UI) and server (API).
 *
 * The user picks an OCCASION, not a tier. This keeps the SRE on rails (the
 * prompt stays grounded in the Style Profile) and prevents the add-on from
 * turning into a free-form mini-report that would undercut the paid tiers.
 */
export type LookContext = {
  id: string;
  /** Short label shown in the selector. */
  label: string;
  /** Stored on the look + fed to the prompt as the occasion brief. */
  context: string;
  /** Styling guidance appended to the generation prompt. */
  brief: string;
};

export const LOOK_CONTEXTS: LookContext[] = [
  {
    id: "work",
    label: "Work / meetings",
    context: "Work / meetings",
    brief:
      "Professional, polished, and quietly authoritative. Tailored but never stuffy.",
  },
  {
    id: "smart_casual",
    label: "Smart casual",
    context: "Smart casual",
    brief:
      "Relaxed but considered — the versatile middle ground between office and weekend.",
  },
  {
    id: "weekend",
    label: "Weekend",
    context: "Weekend",
    brief: "Easy, comfortable, off-duty. Effortless without looking sloppy.",
  },
  {
    id: "dinner",
    label: "Dinner / date",
    context: "Dinner / date",
    brief:
      "A date or evening out — relaxed and approachable, confident without being formal. " +
      "A step up from daywear with a refined edge.",
  },
  {
    id: "formal",
    label: "Formal / event",
    context: "Formal / events",
    brief:
      "Dressed-up for a wedding, gala, or special occasion. Sharp and occasion-appropriate.",
  },
  {
    id: "travel",
    label: "Travel",
    context: "Travel / transitional",
    brief:
      "Comfortable for transit yet put-together on arrival — layered and adaptable.",
  },
  {
    id: "business_social",
    label: "Business social (client dinner · networking · conference)",
    context: "Business social",
    brief:
      "Professional but relaxed — the after-hours edge of work. Polished separates " +
      "over a full suit; approachable, never stiff. Follows the strictness and season settings.",
  },
  {
    id: "wedding_guest",
    label: "Wedding guest",
    context: "Wedding guest",
    brief:
      "Celebratory and occasion-appropriate for a guest (never upstaging). Sharp tailoring, " +
      "seasonal fabric and colour; dress code lifts or relaxes with the strictness setting.",
  },
  {
    id: "party",
    label: "Party / night out",
    context: "Party",
    brief:
      "Evening energy — a confident, considered going-out look with one standout element. " +
      "Bolder at higher strictness; keep it wearable, not costume.",
  },
  {
    id: "cultural",
    label: "Cultural (theatre · gallery · dinner reservation)",
    context: "Cultural",
    brief:
      "Refined, quietly intellectual, put-together without trying hard. Texture over logos; " +
      "season-appropriate layers.",
  },
  {
    id: "outdoor",
    label: "Outdoor / active",
    context: "Outdoor",
    brief:
      "Practical and weather-ready while still looking considered — technical fabrics, layering, " +
      "grounded palette. Strictness nudges rugged↔refined.",
  },
  {
    id: "resort",
    label: "Resort / holiday",
    context: "Resort / holiday",
    brief:
      "Warm-weather ease — breathable fabrics, relaxed tailoring, a lighter palette. Season " +
      "biases fabric weight; strictness nudges beach↔dinner-on-the-terrace.",
  },
];

export function lookContextById(id: string | undefined | null): LookContext | undefined {
  if (!id) return undefined;
  return LOOK_CONTEXTS.find((c) => c.id === id);
}

/** Occasions offered by the shipped single "extra look" add-on. Explicit so
 * that appending new Create-a-Look occasions to LOOK_CONTEXTS never silently
 * expands that live picker. */
export const EXTRA_LOOK_CONTEXT_IDS = [
  "work",
  "smart_casual",
  "weekend",
  "dinner",
  "formal",
  "travel",
] as const;
export const EXTRA_LOOK_CONTEXTS: LookContext[] = LOOK_CONTEXTS.filter((c) =>
  (EXTRA_LOOK_CONTEXT_IDS as readonly string[]).includes(c.id),
);
