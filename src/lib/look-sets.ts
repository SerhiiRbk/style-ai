import type { Intake } from "@/lib/style-profile";
import { DEFAULT_LANGUAGE } from "@/lib/languages";

export const LOOK_SET_BUNDLES = [
  { looks: 3, credits: 12 },
  { looks: 6, credits: 18 },
  { looks: 9, credits: 22 },
] as const;
export const LOYALTY_DISCOUNT = 2;
export const LOYALTY_PURCHASE_THRESHOLD = 20;

export function bundleFor(looks: number) {
  return LOOK_SET_BUNDLES.find((b) => b.looks === looks) ?? null;
}
export function isLoyalty(purchasedCredits: number): boolean {
  return purchasedCredits >= LOYALTY_PURCHASE_THRESHOLD;
}
export function priceForBundle(looks: number, loyalty: boolean): number | null {
  const b = bundleFor(looks);
  if (!b) return null;
  return loyalty ? b.credits - LOYALTY_DISCOUNT : b.credits;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function setName(occasionLabel: string, dateISO: string, collisionTimeHHMM?: string): string {
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  const base = `${occasionLabel} · ${d} ${MONTHS[m - 1]} ${y}`;
  return collisionTimeHHMM ? `${base} · ${collisionTimeHHMM}` : base;
}

export type LookSex = "male";
/** Map the light Create-a-Look intake onto a full Intake with defaults for the
 * fields analyzeProfile/generateExtraLook require but the mini-intake omits. */
export function buildLookIntake(a: { age: number; bodyType?: string; sex?: LookSex }): Intake {
  return {
    age: a.age,
    genderPresentation: a.sex ?? "male",
    language: DEFAULT_LANGUAGE,  // required by the Intake type (schema .default())
    country: "Global",           // required by schema; neutral for global looks
    heightCm: 178,               // neutral default; not user-facing for looks
    bodyType: a.bodyType as Intake["bodyType"],
    occupation: "Not specified", // satisfies the min(1) requirement, neutral
    goals: ["Look considered"],  // one neutral goal; strictness carries intent
    boldness: "moderate",        // overridden per-request in the endpoint
    budgetEur: { min: 0, max: 1000 }, // neutral range for context; not user-facing
  } as Intake;
}
