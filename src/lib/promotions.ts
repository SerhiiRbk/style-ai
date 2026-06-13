import "server-only";
import { randomBytes } from "node:crypto";
import type { createAdminSupabase } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminSupabase>;

/** Cookie set from /login?promo=CODE until the code is redeemed on sign-in. */
export const PENDING_PROMO_COOKIE = "pending_promo";

export type PromotionRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  credits: number;
  max_activations: number;
  activations_count: number;
  expires_at: string;
  active: boolean;
  created_at: string;
};

export type RedeemResult = {
  credits: number;
  balance: number;
  name: string;
  promotionId: string;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate a short, human-friendly promo code (e.g. VLT-A3K9P2M7). */
export function generatePromoCode(): string {
  let body = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    body += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return `VLT-${body}`;
}

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

/** True when the user redeemed any promo (welcome pack via invite / manual code). */
export async function userHasPromoRedemption(
  admin: AdminClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("promotion_redemptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

export function promoErrorMessage(code: string): string {
  switch (code) {
    case "PROMO_NOT_FOUND":
      return "This promo code doesn't exist or is no longer active.";
    case "PROMO_EXPIRED":
      return "This promo has expired.";
    case "PROMO_EXHAUSTED":
      return "This promo has reached its activation limit.";
    case "PROMO_ALREADY_REDEEMED":
      return "You've already used this promo.";
    case "PROMO_INVALID":
      return "Enter a valid promo code.";
    default:
      return "Could not redeem this promo.";
  }
}

/** List all promotions (newest first) for the admin panel. */
export async function listPromotions(admin: AdminClient): Promise<PromotionRow[]> {
  const { data, error } = await admin
    .from("promotions")
    .select(
      "id, code, name, description, credits, max_activations, activations_count, expires_at, active, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PromotionRow[];
}

export type CreatePromotionInput = {
  name: string;
  description?: string;
  credits: number;
  maxActivations: number;
  validDays: number;
  code?: string;
  createdBy?: string;
};

/** Create a promotion. Auto-generates a code when omitted. */
export async function createPromotion(
  admin: AdminClient,
  input: CreatePromotionInput,
): Promise<PromotionRow> {
  const code = normalizePromoCode(input.code?.trim() || generatePromoCode());
  const expiresAt = new Date(
    Date.now() + input.validDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from("promotions")
    .insert({
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      credits: input.credits,
      max_activations: input.maxActivations,
      expires_at: expiresAt,
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, code, name, description, credits, max_activations, activations_count, expires_at, active, created_at",
    )
    .single();

  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      throw new Error("A promo with this code already exists.");
    }
    throw new Error(error.message);
  }
  return data as PromotionRow;
}

/** Redeem a promo for a user. Atomic via redeem_promotion RPC. */
export async function redeemPromotion(
  admin: AdminClient,
  userId: string,
  code: string,
): Promise<RedeemResult> {
  const { data, error } = await admin.rpc("redeem_promotion", {
    p_user_id: userId,
    p_code: normalizePromoCode(code),
  });
  if (error) {
    const msg = error.message ?? "";
    for (const key of [
      "PROMO_NOT_FOUND",
      "PROMO_EXPIRED",
      "PROMO_EXHAUSTED",
      "PROMO_ALREADY_REDEEMED",
      "PROMO_INVALID",
    ]) {
      if (msg.includes(key)) throw new Error(key);
    }
    throw new Error(error.message);
  }
  const row = data as {
    credits: number;
    balance: number;
    name: string;
    promotionId: string;
  };
  return {
    credits: Number(row.credits),
    balance: Number(row.balance),
    name: String(row.name),
    promotionId: String(row.promotionId),
  };
}
