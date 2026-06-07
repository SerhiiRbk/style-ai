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
      "Evening-ready and confident — a step up from daywear with a refined edge.",
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
];

export function lookContextById(id: string | undefined | null): LookContext | undefined {
  if (!id) return undefined;
  return LOOK_CONTEXTS.find((c) => c.id === id);
}
