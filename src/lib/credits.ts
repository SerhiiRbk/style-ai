import "server-only";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { userHasPromoRedemption } from "@/lib/promotions";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { SIGNUP_BONUS } from "@/lib/credit-costs";
import type { CreditReason } from "@/lib/credit-costs";

/**
 * Credit economy. Credits are the real spendable currency of the product:
 * generating a report and every AI render (try-on / regeneration) costs credits.
 * Tiers (free | basic | lookbook | premium) decide which FEATURES a report
 * unlocks; credits decide how much AI work the user can run.
 *
 * Pure cost/package constants live in `@/lib/credit-costs` (client-safe) and
 * are re-exported here so existing server imports keep working.
 */
export {
  REPORT_COST,
  CREDIT_COSTS,
  SIGNUP_BONUS,
  CREDIT_PACKAGES,
} from "@/lib/credit-costs";
export type { CreditReason, CreditPackage } from "@/lib/credit-costs";

type AdminClient = ReturnType<typeof createAdminSupabase>;

/** Thrown by {@link spendCredits} when the user cannot afford the spend. */
export class InsufficientCreditsError extends Error {
  balance: number;
  needed: number;
  constructor(balance: number, needed: number) {
    super("INSUFFICIENT_CREDITS");
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.needed = needed;
  }
}

function isMissingFunction(message: string | undefined): boolean {
  return Boolean(
    message && /could not find|does not exist|schema cache/i.test(message),
  );
}

/** Sum the ledger for a user via the admin client (TS fallback path). */
async function sumLedger(admin: AdminClient, userId: string): Promise<number> {
  const { data, error } = await admin
    .from("credits_ledger")
    .select("delta")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((s, r) => s + (Number(r.delta) || 0), 0);
}

/** Current credit balance for a user (admin client). */
export async function creditBalance(
  admin: AdminClient,
  userId: string,
): Promise<number> {
  const { data, error } = await admin.rpc("credits_balance", {
    p_user_id: userId,
  });
  if (error) {
    if (isMissingFunction(error.message)) return sumLedger(admin, userId);
    throw new Error(error.message);
  }
  return Number(data) || 0;
}

/**
 * Grant credits to a user (positive delta). Future Stripe purchase webhooks
 * should call this with reason "purchase" and the Stripe charge id as refId.
 * Returns the new balance.
 */
export async function grantCredits(
  admin: AdminClient,
  opts: { userId: string; amount: number; reason: CreditReason; refId?: string },
): Promise<number> {
  const { userId, amount, reason, refId } = opts;
  const { data, error } = await admin.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref_id: refId ?? null,
  });
  if (error) {
    if (!isMissingFunction(error.message)) throw new Error(error.message);
    // Fallback: select-then-insert (non-atomic) when the RPC isn't applied yet.
    const balance = (await sumLedger(admin, userId)) + amount;
    const { error: insErr } = await admin
      .from("credits_ledger")
      .insert({ user_id: userId, delta: amount, reason, balance_after: balance });
    if (insErr) throw new Error(insErr.message);
    return balance;
  }
  return Number(data) || 0;
}

/**
 * Idempotently grant credits keyed by an external reference (a Stripe payment
 * id). Safe to call repeatedly for the same `refExt` — a duplicate webhook
 * delivery is a no-op that returns the current balance. Returns the balance.
 */
export async function grantCreditsExternal(
  admin: AdminClient,
  opts: { userId: string; amount: number; reason: CreditReason; refExt: string },
): Promise<number> {
  const { userId, amount, reason, refExt } = opts;
  const { data, error } = await admin.rpc("grant_credits_ext", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref_ext: refExt,
  });
  if (error) {
    if (!isMissingFunction(error.message)) throw new Error(error.message);
    // Fallback (non-atomic): emulate the idempotency guard in TS until the RPC
    // is applied. The unique index on ref_ext is the ultimate backstop.
    const { data: existing, error: selErr } = await admin
      .from("credits_ledger")
      .select("id")
      .eq("ref_ext", refExt)
      .limit(1);
    if (selErr) throw new Error(selErr.message);
    if (existing && existing.length) return sumLedger(admin, userId);
    const balance = (await sumLedger(admin, userId)) + amount;
    const { error: insErr } = await admin.from("credits_ledger").insert({
      user_id: userId,
      delta: amount,
      reason,
      ref_ext: refExt,
      balance_after: balance,
    });
    if (insErr) {
      // Unique-violation ⇒ a concurrent/duplicate grant won the race; treat as done.
      if (/duplicate key|unique/i.test(insErr.message)) {
        return sumLedger(admin, userId);
      }
      throw new Error(insErr.message);
    }
    return balance;
  }
  return Number(data) || 0;
}

/**
 * Spend credits (negative delta) with a balance guard. Throws
 * {@link InsufficientCreditsError} when the user cannot afford it. Returns the
 * new balance on success. Atomic per-user when the spend_credits RPC is applied.
 */
export async function spendCredits(
  admin: AdminClient,
  opts: { userId: string; amount: number; reason: CreditReason; refId?: string },
): Promise<number> {
  const { userId, amount, reason, refId } = opts;
  if (amount <= 0) return creditBalance(admin, userId);

  const { data, error } = await admin.rpc("spend_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref_id: refId ?? null,
  });
  if (error) {
    if (/INSUFFICIENT_CREDITS/.test(error.message)) {
      const balance = await sumLedger(admin, userId);
      throw new InsufficientCreditsError(balance, amount);
    }
    if (!isMissingFunction(error.message)) throw new Error(error.message);
    // Fallback: select-then-insert with guard (non-atomic) until RPC is applied.
    const balance = await sumLedger(admin, userId);
    if (balance < amount) throw new InsufficientCreditsError(balance, amount);
    const next = balance - amount;
    const { error: insErr } = await admin
      .from("credits_ledger")
      .insert({ user_id: userId, delta: -amount, reason, balance_after: next });
    if (insErr) throw new Error(insErr.message);
    return next;
  }
  return Number(data) || 0;
}

/**
 * Refund report credits when generation fails after a successful spend.
 * Idempotent per report — safe to call more than once for the same reportId.
 */
export async function refundReportCredits(
  admin: AdminClient,
  opts: { userId: string; amount: number; reportId: string },
): Promise<void> {
  const { userId, amount, reportId } = opts;
  if (amount <= 0) return;

  const { data: existing, error: selErr } = await admin
    .from("credits_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", "report_refund")
    .eq("ref_id", reportId)
    .limit(1);
  if (selErr) throw new Error(selErr.message);
  if (existing && existing.length > 0) return;

  await grantCredits(admin, {
    userId,
    amount,
    reason: "report_refund",
    refId: reportId,
  });
}

/**
 * Grant the one-time signup bonus the first time it's needed (idempotent).
 * Skipped when the user already redeemed a promo — registration welcome is
 * either signup credits OR promo credits, not both.
 */
export async function ensureSignupBonus(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  if (await userHasPromoRedemption(admin, userId)) return;

  const { data, error } = await admin
    .from("credits_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", "signup_bonus")
    .limit(1);
  if (error) {
    if (isMissingFunction(error.message)) return;
    throw new Error(error.message);
  }
  if (data && data.length > 0) return;
  await grantCredits(admin, {
    userId,
    amount: SIGNUP_BONUS,
    reason: "signup_bonus",
  });
}

/**
 * Read the signed-in user's credit balance for display (Navbar, /reports,
 * report page). RLS-scoped to the owner; returns null in demo mode or when
 * unauthenticated. Never throws — display code should degrade gracefully.
 */
export async function getCreditBalance(): Promise<number | null> {
  if (!hasSupabase) return null;
  try {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;

    if (hasSupabaseAdmin) {
      const admin = createAdminSupabase();
      try {
        await ensureSignupBonus(admin, user.id);
      } catch {
        // Non-fatal — still return whatever balance we can read.
      }
      return await creditBalance(admin, user.id);
    }
    // Owner can read their own ledger rows under RLS.
    const { data, error } = await sb
      .from("credits_ledger")
      .select("delta")
      .eq("user_id", user.id);
    if (error) return null;
    return (data ?? []).reduce((s, r) => s + (Number(r.delta) || 0), 0);
  } catch {
    return null;
  }
}
