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
  /** A premium add-on render (e.g. facial-hair / eyewear preview). */
  premium_addon: 3,
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
