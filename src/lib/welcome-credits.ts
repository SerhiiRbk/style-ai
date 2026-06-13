import "server-only";
import { ensureSignupBonus } from "@/lib/credits";
import {
  PENDING_PROMO_COOKIE,
  redeemPromotion,
  userHasPromoRedemption,
} from "@/lib/promotions";
import type { createAdminSupabase } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminSupabase>;

export { PENDING_PROMO_COOKIE };

/**
 * Apply welcome credits on first sign-in / email confirm:
 * pending invite promo replaces the default signup bonus; otherwise grant signup.
 * Existing users who redeem promos later use /api/promo/redeem instead.
 */
export async function applyWelcomeCredits(
  admin: AdminClient,
  userId: string,
  pendingPromoCode?: string | null,
): Promise<"promo" | "signup" | "already"> {
  if (pendingPromoCode) {
    try {
      await redeemPromotion(admin, userId, pendingPromoCode);
      return "promo";
    } catch {
      // Invalid/expired invite code — fall back to the standard signup bonus.
    }
  }

  if (await userHasPromoRedemption(admin, userId)) {
    return "already";
  }

  await ensureSignupBonus(admin, userId);
  return "signup";
}
