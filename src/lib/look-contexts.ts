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
      "Evening / night-out energy. Dress for after dark, not the office: one standout garment " +
      "and a vivid colour story from the palette. Conservative stays sharp; Statement goes bold — " +
      "richer colour, unexpected pairings, evening fabrics. Wearable, never costume, never a " +
      "daytime jumper-and-tote.",
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

/** Resolve a stored look `context` string (or an occasion id) to LOOK_CONTEXTS id. */
export function lookOccasionIdFromContext(
  context: string | null | undefined,
): string | null {
  if (!context?.trim()) return null;
  const raw = context.trim();
  if (lookContextById(raw)) return raw;
  const exact = LOOK_CONTEXTS.find(
    (c) => c.context === raw || c.label === raw,
  );
  if (exact) return exact.id;
  const lower = raw.toLowerCase();
  if (/\bwork\b|\bmeeting|\bon stage\b|\bclient\b/.test(lower)) return "work";
  if (/\bdinner\b|\bdate night\b|\bevening/.test(lower)) return "dinner";
  if (/\bsmart casual\b/.test(lower)) return "smart_casual";
  if (/\bformal\b/.test(lower)) return "formal";
  return null;
}

/** Reserved occasion for look sets mirrored from a Style Report. Not in the
 *  Create-a-Look picker — reports already chose their own mix of contexts. */
export const REPORT_LOOK_SET_OCCASION_ID = "style_report";

export function lookSetOccasionLabel(id: string | undefined | null): string {
  if (id === REPORT_LOOK_SET_OCCASION_ID) return "Style report";
  return lookContextById(id)?.label ?? "Looks";
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
