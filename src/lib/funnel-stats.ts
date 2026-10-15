import "server-only";
import { FUNNEL_EVENTS, type FunnelEventName } from "@/lib/funnel";
import type { createAdminSupabase } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminSupabase>;

export type FunnelStepCount = {
  name: FunnelEventName;
  events: number;
  visitors: number;
};

export async function loadFunnelWeek(
  admin: AdminClient,
): Promise<{ since: string; steps: FunnelStepCount[] }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("events")
    .select("name, anon_id, user_id")
    .in("name", [...FUNNEL_EVENTS])
    .gte("created_at", since)
    .limit(8000);

  const byName = new Map<string, { events: number; keys: Set<string> }>();
  for (const name of FUNNEL_EVENTS) {
    byName.set(name, { events: 0, keys: new Set() });
  }
  for (const row of data ?? []) {
    const bucket = byName.get(row.name as string);
    if (!bucket) continue;
    bucket.events += 1;
    const key =
      (row.user_id as string | null) ||
      (row.anon_id as string | null) ||
      `row:${bucket.events}`;
    bucket.keys.add(key);
  }

  return {
    since,
    steps: FUNNEL_EVENTS.map((name) => {
      const bucket = byName.get(name)!;
      return { name, events: bucket.events, visitors: bucket.keys.size };
    }),
  };
}
