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
  | "admin_grant";

/** Credits charged to generate a report, by tier. */
export const REPORT_COST: Record<Tier, number> = {
  free: 3,
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
  /** A premium add-on render (e.g. facial-hair / eyewear preview). */
  premium_addon: 3,
} as const;

/** Credits granted once on signup — free report (3) + one try-on (1). */
export const SIGNUP_BONUS = 5;

/** Purchasable credit packages. Prices are clean per-currency numbers (no FX). */
export type CreditPackage = {
  id: "starter" | "plus" | "pro";
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
    name: "Starter",
    credits: 10,
    bonus: 0,
    price: { EUR: "€19", USD: "$21" },
    blurb: "One full report, or a stack of try-ons.",
  },
  {
    id: "plus",
    name: "Plus",
    credits: 25,
    bonus: 5,
    price: { EUR: "€39", USD: "$43" },
    blurb: "A report plus room to experiment.",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 60,
    bonus: 15,
    price: { EUR: "€79", USD: "$86" },
    blurb: "Best value — multiple reports & unlimited play.",
  },
];
