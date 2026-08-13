import "server-only";
import { creditBalance } from "@/lib/credits";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { lookContextById } from "@/lib/look-contexts";
import type { Tier } from "@/lib/report";

const PAGE_SIZE = 30;

type LedgerRow = {
  user_id: string;
  delta: number;
  reason: string;
  ref_id: string | null;
  ref_ext: string | null;
  balance_after: number | null;
  created_at: string;
};

function spendCountByReason(rows: LedgerRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.delta >= 0) continue;
    out[row.reason] = (out[row.reason] ?? 0) + 1;
  }
  return out;
}

function sumDeltas(rows: LedgerRow[]): { earned: number; spent: number } {
  let earned = 0;
  let spent = 0;
  for (const row of rows) {
    if (row.delta > 0) earned += row.delta;
    else spent += Math.abs(row.delta);
  }
  return { earned, spent };
}

export type AdminUserSummary = {
  id: string;
  email: string | null;
  country: string | null;
  locale: string | null;
  createdAt: string;
  creditBalance: number;
  reportsCount: number;
  looksCount: number;
  purchasesCount: number;
  creditsPurchased: number;
  promosCount: number;
  tryonsCount: number;
  photosCount: number;
  creditsSpent: number;
  creditsEarned: number;
  activityByReason: Record<string, number>;
};

/** Slim snapshot of the questionnaire used to generate a report (admin UI). */
export type AdminUserReportIntake = {
  age?: number;
  genderPresentation?: string;
  city?: string;
  country?: string;
  language?: string;
  currency?: string;
  heightCm?: number;
  weightKg?: number;
  bodyType?: string;
  hairColor?: string;
  eyeColor?: string;
  occupation?: string;
  lifestyle?: string[];
  goals?: string[];
  boldness?: string;
  budgetMin?: number;
  budgetMax?: number;
  notes?: string;
};

export type AdminUserReport = {
  id: string;
  createdAt: string;
  headline: string | null;
  tier: Tier;
  status: "processing" | "ready" | "failed";
  /** Generation questionnaire at submit time; null when missing (legacy). */
  intake: AdminUserReportIntake | null;
};

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
  return out.length ? out : undefined;
}

/** Pick the generation parameters we surface in the admin user detail panel. */
function slimIntake(raw: unknown): AdminUserReportIntake | null {
  if (!raw || typeof raw !== "object") return null;
  const i = raw as Record<string, unknown>;
  const budget =
    i.budgetEur && typeof i.budgetEur === "object"
      ? (i.budgetEur as Record<string, unknown>)
      : null;
  const slim: AdminUserReportIntake = {
    age: asNumber(i.age),
    genderPresentation: asString(i.genderPresentation),
    city: asString(i.city),
    country: asString(i.country),
    language: asString(i.language),
    currency: asString(i.currency),
    heightCm: asNumber(i.heightCm),
    weightKg: asNumber(i.weightKg),
    bodyType: asString(i.bodyType),
    hairColor: asString(i.hairColor),
    eyeColor: asString(i.eyeColor),
    occupation: asString(i.occupation),
    lifestyle: asStringArray(i.lifestyle),
    goals: asStringArray(i.goals),
    boldness: asString(i.boldness),
    budgetMin: budget ? asNumber(budget.min) : undefined,
    budgetMax: budget ? asNumber(budget.max) : undefined,
    notes: asString(i.notes),
  };
  return Object.values(slim).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined,
  )
    ? slim
    : null;
}

export type AdminUserPurchase = {
  createdAt: string;
  credits: number;
  refExt: string | null;
};

export type AdminUserPromo = {
  code: string;
  name: string;
  credits: number;
  redeemedAt: string;
};

export type AdminUserLedgerEntry = {
  createdAt: string;
  delta: number;
  reason: string;
  refId: string | null;
  refExt: string | null;
  balanceAfter: number | null;
};

export type AdminUserLookSet = {
  id: string;
  createdAt: string;
  occasionId: string | null;
  occasionLabel: string | null;
  isPublic: boolean;
};

export type AdminUserDetail = AdminUserSummary & {
  reports: AdminUserReport[];
  lookSets: AdminUserLookSet[];
  purchases: AdminUserPurchase[];
  promos: AdminUserPromo[];
  ledger: AdminUserLedgerEntry[];
  tryonsReady: number;
  tryonsFailed: number;
};

async function loadProfileStats(
  admin: ReturnType<typeof createAdminSupabase>,
  userIds: string[],
): Promise<Map<string, AdminUserSummary>> {
  const map = new Map<string, AdminUserSummary>();

  if (!userIds.length) return map;

  const [
    { data: ledgerRows },
    { data: reportRows },
    { data: lookSetRows },
    { data: tryonRows },
    { data: photoRows },
    { data: promoRows },
  ] = await Promise.all([
    admin
      .from("credits_ledger")
      .select("user_id, delta, reason, ref_id, ref_ext, balance_after, created_at")
      .in("user_id", userIds),
    admin.from("reports").select("user_id").in("user_id", userIds),
    admin.from("look_sets").select("user_id").in("user_id", userIds),
    admin.from("tryons").select("user_id, status").in("user_id", userIds),
    admin.from("photos").select("user_id").in("user_id", userIds),
    admin
      .from("promotion_redemptions")
      .select("user_id")
      .in("user_id", userIds),
  ]);

  const ledgerByUser = new Map<string, LedgerRow[]>();
  for (const row of ledgerRows ?? []) {
    const uid = row.user_id as string;
    const list = ledgerByUser.get(uid) ?? [];
    list.push(row as LedgerRow);
    ledgerByUser.set(uid, list);
  }

  const reportCount = new Map<string, number>();
  for (const row of reportRows ?? []) {
    const uid = row.user_id as string;
    reportCount.set(uid, (reportCount.get(uid) ?? 0) + 1);
  }

  const lookSetCount = new Map<string, number>();
  for (const row of lookSetRows ?? []) {
    const uid = row.user_id as string;
    lookSetCount.set(uid, (lookSetCount.get(uid) ?? 0) + 1);
  }

  const tryonCount = new Map<string, number>();
  for (const row of tryonRows ?? []) {
    const uid = row.user_id as string;
    tryonCount.set(uid, (tryonCount.get(uid) ?? 0) + 1);
  }

  const photoCount = new Map<string, number>();
  for (const row of photoRows ?? []) {
    const uid = row.user_id as string;
    photoCount.set(uid, (photoCount.get(uid) ?? 0) + 1);
  }

  const promoCount = new Map<string, number>();
  for (const row of promoRows ?? []) {
    const uid = row.user_id as string;
    promoCount.set(uid, (promoCount.get(uid) ?? 0) + 1);
  }

  for (const userId of userIds) {
    const ledger = ledgerByUser.get(userId) ?? [];
    const { earned, spent } = sumDeltas(ledger);
    const purchases = ledger.filter((r) => r.reason === "purchase" && r.delta > 0);
    const creditsPurchased = purchases.reduce((s, r) => s + r.delta, 0);

    const balance = ledger.reduce((s, r) => s + (Number(r.delta) || 0), 0);

    map.set(userId, {
      id: userId,
      email: null,
      country: null,
      locale: null,
      createdAt: "",
      creditBalance: balance,
      reportsCount: reportCount.get(userId) ?? 0,
      looksCount: lookSetCount.get(userId) ?? 0,
      purchasesCount: purchases.length,
      creditsPurchased,
      promosCount: promoCount.get(userId) ?? 0,
      tryonsCount: tryonCount.get(userId) ?? 0,
      photosCount: photoCount.get(userId) ?? 0,
      creditsSpent: spent,
      creditsEarned: earned,
      activityByReason: spendCountByReason(ledger),
    });
  }

  return map;
}

export async function listAdminUsers(opts?: {
  page?: number;
  q?: string;
}): Promise<{
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} | null> {
  if (!hasSupabaseAdmin) return null;

  const page = Math.max(1, opts?.page ?? 1);
  const q = opts?.q?.trim() ?? "";
  const admin = createAdminSupabase();
  const from = (page - 1) * PAGE_SIZE;

  let query = admin
    .from("profiles")
    .select("id, email, country, locale, created_at", { count: "exact" });

  if (q) query = query.ilike("email", `%${q}%`);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw new Error(error.message);

  const profiles = data ?? [];
  const userIds = profiles.map((p) => p.id as string);
  const statsMap = await loadProfileStats(admin, userIds);

  const users: AdminUserSummary[] = [];
  for (const p of profiles) {
    const id = p.id as string;
    const stats = statsMap.get(id);
    users.push({
      id,
      email: (p.email as string | null) ?? null,
      country: (p.country as string | null) ?? null,
      locale: (p.locale as string | null) ?? null,
      createdAt: p.created_at as string,
      creditBalance: stats?.creditBalance ?? 0,
      reportsCount: stats?.reportsCount ?? 0,
      looksCount: stats?.looksCount ?? 0,
      purchasesCount: stats?.purchasesCount ?? 0,
      creditsPurchased: stats?.creditsPurchased ?? 0,
      promosCount: stats?.promosCount ?? 0,
      tryonsCount: stats?.tryonsCount ?? 0,
      photosCount: stats?.photosCount ?? 0,
      creditsSpent: stats?.creditsSpent ?? 0,
      creditsEarned: stats?.creditsEarned ?? 0,
      activityByReason: stats?.activityByReason ?? {},
    });
  }

  const total = count ?? 0;
  return {
    users,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  if (!hasSupabaseAdmin) return null;

  const admin = createAdminSupabase();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, country, locale, created_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) return null;

  const [
    balance,
    { data: reportRows },
    { data: lookSetRows },
    { data: ledgerRows },
    { data: promoRows },
    { data: tryonRows },
    { data: photoRows },
  ] = await Promise.all([
    creditBalance(admin, userId),
    admin
      .from("reports")
      .select("id, created_at, headline, tier, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("look_sets")
      .select("id, created_at, occasion_id, is_public")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("credits_ledger")
      .select("delta, reason, ref_id, ref_ext, balance_after, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("promotion_redemptions")
      .select("redeemed_at, promotions(code, name, credits)")
      .eq("user_id", userId)
      .order("redeemed_at", { ascending: false }),
    admin
      .from("tryons")
      .select("status")
      .eq("user_id", userId),
    admin.from("photos").select("id").eq("user_id", userId),
  ]);

  const ledger = (ledgerRows ?? []) as Omit<LedgerRow, "user_id">[];
  const fullLedger: LedgerRow[] = ledger.map((r) => ({
    ...r,
    user_id: userId,
  }));
  const { earned, spent } = sumDeltas(fullLedger);
  const activityByReason = spendCountByReason(fullLedger);
  const purchases = fullLedger
    .filter((r) => r.reason === "purchase" && r.delta > 0)
    .map((r) => ({
      createdAt: r.created_at,
      credits: r.delta,
      refExt: r.ref_ext,
    }));

  const reportIds = (reportRows ?? []).map((r) => r.id as string);
  const intakeByReport = new Map<string, AdminUserReportIntake | null>();
  if (reportIds.length) {
    const { data: intakeRows } = await admin
      .from("report_intake")
      .select("report_id, intake")
      .in("report_id", reportIds);
    for (const row of intakeRows ?? []) {
      intakeByReport.set(
        row.report_id as string,
        slimIntake(row.intake),
      );
    }
  }

  const reports: AdminUserReport[] = (reportRows ?? []).map((row) => ({
    id: row.id as string,
    createdAt: row.created_at as string,
    headline: (row.headline as string | null) ?? null,
    tier: (row.tier as Tier) ?? "basic",
    status:
      row.status === "processing" || row.status === "failed"
        ? row.status
        : "ready",
    intake: intakeByReport.get(row.id as string) ?? null,
  }));

  const lookSets: AdminUserLookSet[] = (lookSetRows ?? []).map((row) => {
    const occasionId = (row.occasion_id as string | null) ?? null;
    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      occasionId,
      occasionLabel: lookContextById(occasionId)?.label ?? occasionId,
      isPublic: Boolean(row.is_public),
    };
  });

  const promos: AdminUserPromo[] = [];
  for (const row of promoRows ?? []) {
    const promo = row.promotions as
      | { code: string; name: string; credits: number }
      | { code: string; name: string; credits: number }[]
      | null;
    const p = Array.isArray(promo) ? promo[0] : promo;
    if (!p) continue;
    promos.push({
      code: p.code,
      name: p.name,
      credits: p.credits,
      redeemedAt: row.redeemed_at as string,
    });
  }

  let tryonsReady = 0;
  let tryonsFailed = 0;
  for (const row of tryonRows ?? []) {
    if (row.status === "ready") tryonsReady++;
    else if (row.status === "failed") tryonsFailed++;
  }

  return {
    id: userId,
    email: (profile.email as string | null) ?? null,
    country: (profile.country as string | null) ?? null,
    locale: (profile.locale as string | null) ?? null,
    createdAt: profile.created_at as string,
    creditBalance: balance,
    reportsCount: reports.length,
    looksCount: lookSets.length,
    purchasesCount: purchases.length,
    creditsPurchased: purchases.reduce((s, p) => s + p.credits, 0),
    promosCount: promos.length,
    tryonsCount: tryonRows?.length ?? 0,
    photosCount: photoRows?.length ?? 0,
    creditsSpent: spent,
    creditsEarned: earned,
    activityByReason,
    reports,
    lookSets,
    purchases,
    promos,
    tryonsReady,
    tryonsFailed,
    ledger: fullLedger.map((r) => ({
      createdAt: r.created_at,
      delta: r.delta,
      reason: r.reason,
      refId: r.ref_id,
      refExt: r.ref_ext,
      balanceAfter: r.balance_after,
    })),
  };
}
