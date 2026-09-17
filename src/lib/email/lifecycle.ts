import "server-only";
import { logEvent } from "@/lib/events";
import type { createAdminSupabase } from "@/lib/supabase/server";
import {
  sendAbandonedIntakeEmail,
  sendDay3AfterReportEmail,
  sendWelcomeEmail,
} from "@/lib/email/send";

type AdminClient = ReturnType<typeof createAdminSupabase>;

async function alreadySent(
  admin: AdminClient,
  userId: string,
  name: string,
): Promise<boolean> {
  const { data } = await admin
    .from("events")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function markSent(
  userId: string,
  name: string,
  props?: Record<string, unknown>,
): Promise<void> {
  await logEvent({ name, userId, props });
}

async function emailForUser(
  admin: AdminClient,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const email = data?.email;
  return typeof email === "string" && email.includes("@") ? email : null;
}

/** First-grant welcome — once per user, only right after the signup bonus. */
export async function notifyWelcomeEmail(
  admin: AdminClient,
  userId: string,
): Promise<boolean> {
  if (await alreadySent(admin, userId, "email_welcome_sent")) return false;
  const { data: grant } = await admin
    .from("credits_ledger")
    .select("created_at")
    .eq("user_id", userId)
    .in("reason", ["signup_bonus", "promo"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const grantedAt = grant?.created_at
    ? new Date(grant.created_at as string).getTime()
    : 0;
  if (!grantedAt || Date.now() - grantedAt > 15 * 60 * 1000) return false;
  const email = await emailForUser(admin, userId);
  if (!email) return false;
  const ok = await sendWelcomeEmail(email);
  if (ok) await markSent(userId, "email_welcome_sent");
  return ok;
}

const ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000;
const DAY3_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const DAY3_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const BATCH = 40;

export async function sendAbandonedIntakeBatch(
  admin: AdminClient,
): Promise<{ candidates: number; sent: number }> {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS).toISOString();
  const { data: photos } = await admin
    .from("photos")
    .select("user_id")
    .lt("created_at", cutoff)
    .limit(400);
  const userIds = [
    ...new Set(
      (photos ?? [])
        .map((p) => p.user_id as string)
        .filter(Boolean),
    ),
  ].slice(0, 120);
  if (!userIds.length) return { candidates: 0, sent: 0 };

  const { data: ready } = await admin
    .from("reports")
    .select("user_id")
    .in("user_id", userIds)
    .eq("status", "ready");
  const readySet = new Set((ready ?? []).map((r) => r.user_id as string));
  const { data: sentRows } = await admin
    .from("events")
    .select("user_id")
    .in("user_id", userIds)
    .eq("name", "email_abandoned_intake_sent");
  const sentSet = new Set((sentRows ?? []).map((r) => r.user_id as string));

  let sent = 0;
  let candidates = 0;
  for (const userId of userIds) {
    if (readySet.has(userId) || sentSet.has(userId)) continue;
    candidates++;
    if (sent >= BATCH) break;
    const email = await emailForUser(admin, userId);
    if (!email) continue;
    const ok = await sendAbandonedIntakeEmail(email);
    if (!ok) continue;
    await markSent(userId, "email_abandoned_intake_sent");
    sent++;
  }
  return { candidates, sent };
}

export async function sendDay3AfterReportBatch(
  admin: AdminClient,
): Promise<{ candidates: number; sent: number }> {
  const older = new Date(Date.now() - DAY3_AFTER_MS).toISOString();
  const newer = new Date(Date.now() - DAY3_AFTER_MS - DAY3_WINDOW_MS).toISOString();
  const { data: reports } = await admin
    .from("reports")
    .select("id, user_id")
    .eq("status", "ready")
    .lte("created_at", older)
    .gte("created_at", newer)
    .limit(80);
  const rows = reports ?? [];
  if (!rows.length) return { candidates: 0, sent: 0 };

  const userIds = [...new Set(rows.map((r) => r.user_id as string).filter(Boolean))];
  const { data: sentRows } = await admin
    .from("events")
    .select("user_id")
    .in("user_id", userIds)
    .eq("name", "email_day3_sent");
  const sentSet = new Set((sentRows ?? []).map((r) => r.user_id as string));

  let sent = 0;
  let candidates = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const userId = row.user_id as string;
    if (!userId || seen.has(userId) || sentSet.has(userId)) continue;
    seen.add(userId);
    candidates++;
    if (sent >= BATCH) break;
    const email = await emailForUser(admin, userId);
    if (!email) continue;
    const ok = await sendDay3AfterReportEmail(email, row.id as string);
    if (!ok) continue;
    await markSent(userId, "email_day3_sent", { report_id: row.id });
    sent++;
  }
  return { candidates, sent };
}
