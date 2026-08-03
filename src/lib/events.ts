import "server-only";
import { hasSupabaseAdmin } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/server";

export type EventInput = {
  /** Event name, e.g. `rate_limited`, `colours_result` (see growth spec §4 A1). */
  name: string;
  /** Anonymous cookie id, when known. NULL for pure server-side events. */
  anonId?: string | null;
  /** Signed-in user id, when known. */
  userId?: string | null;
  /** Arbitrary structured payload (bucket, level, etc.). */
  props?: Record<string, unknown>;
};

/**
 * Best-effort append to `public.events`. Never throws and never blocks the
 * request path meaningfully — analytics must not be able to break a feature.
 * Without these rows a quiet funnel is indistinguishable from a broken one.
 */
export async function logEvent(event: EventInput): Promise<void> {
  if (!hasSupabaseAdmin) return;
  try {
    const admin = createAdminSupabase();
    await admin.from("events").insert({
      name: event.name,
      anon_id: event.anonId ?? null,
      user_id: event.userId ?? null,
      props: event.props ?? {},
    });
  } catch (err) {
    console.error("[events] log failed", event.name, err);
  }
}

/**
 * Stitch an anonymous visitor to their new account at registration/first auth
 * (§5.2 п.7). Emits an `identify` bridge row and backfills the visitor's prior
 * anonymous events with the user id, so "anon viewed → registered → bought"
 * joins into one funnel. Best-effort — never blocks the auth flow.
 */
export async function linkAnonToUser(
  userId: string,
  anonId: string | null,
): Promise<void> {
  if (!hasSupabaseAdmin) return;
  await logEvent({ name: "identify", anonId, userId });
  if (!anonId) return;
  try {
    const admin = createAdminSupabase();
    await admin
      .from("events")
      .update({ user_id: userId })
      .eq("anon_id", anonId)
      .is("user_id", null);
  } catch (err) {
    console.error("[events] anon link failed", err);
  }
}
