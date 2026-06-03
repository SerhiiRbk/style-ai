import "server-only";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
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
 * Grant the one-time signup bonus the first time it's needed (idempotent —
 * only grants when no prior signup_bonus row exists for the user).
 */
export async function ensureSignupBonus(
  admin: AdminClient,
  userId: string,
): Promise<void> {
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
      return await creditBalance(createAdminSupabase(), user.id);
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
