/**
 * Credit economy constants — pure data, safe to import from both client and
 * server. The server-only ledger helpers (grant / spend / balance) live in
 * `@/lib/credits` and re-export everything here for convenience.
 */
import type { SubCurrency } from "@/lib/currency";
import type { Tier } from "@/lib/report";

export type CreditReason =
  | "signup_bonus"
  | "purchase"
  | "report"
  | "tryon"
  | "regen"
  | "premium_addon"
  | "look_extra"
  | "look_regen"
  | "admin_grant";

/** Credits charged to generate a report, by tier. */
export const REPORT_COST: Record<Tier, number> = {
  free: 5,
  basic: 10,
  lookbook: 20,
  premium: 35,
};

/** Per-action credit costs. */
export const CREDIT_COSTS = {
  /** Virtual try-on of a single garment or a full look. */
  tryon: 1,
  /** Re-rendering a try-on ("Render again"). */
  regen: 1,
  /**
   * One standalone extra look generated on the user's photo for an existing
   * report (any tier). Priced so multiple extra looks never undercut a richer
   * report tier: 2 looks = Basic price (no consultation/PDF), 4 = Lookbook
   * (no capsule), 6 < Premium (no grooming). Try-on on the look is billed
   * separately at `tryon`.
   */
  look_extra: 5,
  /** Re-render an extra look's photo (cheaper than a brand-new look). */
  look_regen: 3,
  /** A premium add-on render (e.g. facial-hair / eyewear preview). */
  premium_addon: 3,
  /** One-time "generate 2 more" accessory previews on a premium report. */
  accessory_extra: 2,
  /** One-time "generate 2 more" facial-hair previews on a premium report. */
  facialhair_extra: 2,
  /** One-time "generate 2 optical + 2 sunglasses" extra eyewear previews. */
  eyewear_extra: 5,
  /**
   * Non-premium "unlock" add-ons — generate the full base set on the user's
   * photo for a report that doesn't include it. Priced ABOVE the equivalent
   * Premium value on purpose, to nudge the customer toward Premium.
   */
  facialhair_addon: 10,
  eyewear_addon: 10,
  accessory_addon: 5,
} as const;

/** Credits granted once on signup — Starter Report (5) + one try-on (1). */
export const SIGNUP_BONUS = 6;

/** Purchasable credit packages. Prices are clean per-currency numbers (no FX). */
export type CreditPackage = {
  id: "starter" | "plus" | "pro" | "max";
  name: string;
  /** Base credits purchased. */
  credits: number;
  /** Extra bonus credits on top. */
  bonus: number;
  price: Record<SubCurrency, string>;
  blurb: string;
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    name: "Single",
    credits: 10,
    bonus: 1,
    price: { EUR: "€10", USD: "$11" },
    blurb: "One Basic report, or a handful of try-ons.",
  },
  {
    id: "plus",
    name: "Plus",
    credits: 20,
    bonus: 2,
    price: { EUR: "€20", USD: "$22" },
    blurb: "A Lookbook report with credits to spare.",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 35,
    bonus: 5,
    price: { EUR: "€35", USD: "$38" },
    blurb: "A Premium report plus extra try-ons.",
  },
  {
    id: "max",
    name: "Max",
    credits: 80,
    bonus: 20,
    price: { EUR: "€79", USD: "$86" },
    blurb: "For stylists & power users — multiple Premium reports.",
  },
];
