/** Human-readable labels for credits_ledger `reason` values (client-safe). */
export const CREDIT_REASON_LABELS: Record<string, string> = {
  signup_bonus: "Signup bonus",
  purchase: "Credit purchase",
  promo: "Promo redemption",
  report: "Report generated",
  tryon: "Try-on",
  complete_look: "Complete the look",
  regen: "Re-render (hair / try-on)",
  premium_addon: "Grooming unlock / extra previews",
  look_extra: "Extra look generated",
  look_regen: "Look re-render",
  look_three_quarter: "Look 3/4 view",
  admin_grant: "Admin grant",
};

export function creditReasonLabel(reason: string): string {
  return CREDIT_REASON_LABELS[reason] ?? reason;
}
