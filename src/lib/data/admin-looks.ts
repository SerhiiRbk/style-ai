import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";
import { LOOK_CONTEXTS, lookSetOccasionLabel } from "@/lib/look-contexts";

export type AdminLookSetSummary = {
  id: string;
  createdAt: string;
  occasionId: string | null;
  occasionLabel: string | null;
  status: "generating" | "ready";
  looksCount: number | null;
  readyCount: number;
  userId: string;
  userEmail: string | null;
  isPublic: boolean;
};

const PAGE_SIZE = 50;

const FULL_SELECT =
  "id, created_at, user_id, occasion_id, is_public, status, looks_count";
const LEGACY_SELECT = "id, created_at, user_id, occasion_id, is_public";

function occasionIdsMatching(q: string): string[] {
  const needle = q.toLowerCase();
  return LOOK_CONTEXTS.filter(
    (c) =>
      c.id.toLowerCase().includes(needle) ||
      c.label.toLowerCase().includes(needle),
  ).map((c) => c.id);
}

function occasionLabel(id: string | null): string | null {
  if (!id) return null;
  return lookSetOccasionLabel(id);
}

export async function listAdminLookSets(opts?: {
  page?: number;
  q?: string;
}): Promise<{
  lookSets: AdminLookSetSummary[];
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

  async function run(select: string) {
    let query = admin.from("look_sets").select(select, { count: "exact" });

    if (q) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", `%${q}%`);
      const userIds = (profiles ?? []).map((p) => p.id as string);
      const occasionIds = occasionIdsMatching(q);
      const clauses: string[] = [`occasion_id.ilike.%${q}%`];
      if (userIds.length) clauses.push(`user_id.in.(${userIds.join(",")})`);
      if (occasionIds.length) {
        clauses.push(`occasion_id.in.(${occasionIds.join(",")})`);
      }
      query = query.or(clauses.join(","));
    }

    return query
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
  }

  let { data, count, error } = await run(FULL_SELECT);
  if (error && /status|looks_count/.test(error.message)) {
    ({ data, count, error } = await run(LEGACY_SELECT));
  }
  if (error) throw new Error(error.message);

  type LookSetListRow = {
    id: string;
    created_at: string;
    user_id: string;
    occasion_id: string | null;
    is_public: boolean | null;
    status?: string | null;
    looks_count?: number | null;
  };
  const rows = ((data ?? []) as unknown as LookSetListRow[]);
  const setIds = rows.map((r) => r.id as string);
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const emailByUser = new Map<string, string | null>();
  const readyBySet = new Map<string, number>();

  if (userIds.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      emailByUser.set(p.id as string, (p.email as string | null) ?? null);
    }
  }

  if (setIds.length) {
    const { data: lookRows } = await admin
      .from("looks")
      .select("set_id, image_path")
      .in("set_id", setIds);
    for (const row of lookRows ?? []) {
      if (!row.image_path) continue;
      const setId = row.set_id as string;
      readyBySet.set(setId, (readyBySet.get(setId) ?? 0) + 1);
    }
  }

  const lookSets: AdminLookSetSummary[] = rows.map((row) => {
    const statusRaw = row.status;
    return {
      id: row.id,
      createdAt: row.created_at,
      occasionId: row.occasion_id ?? null,
      occasionLabel: occasionLabel(row.occasion_id ?? null),
      status: statusRaw === "generating" ? "generating" : "ready",
      looksCount: typeof row.looks_count === "number" ? row.looks_count : null,
      readyCount: readyBySet.get(row.id) ?? 0,
      userId: row.user_id,
      userEmail: emailByUser.get(row.user_id) ?? null,
      isPublic: Boolean(row.is_public),
    };
  });

  const total = count ?? 0;
  return {
    lookSets,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
