import "server-only";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export type AdminPageGate =
  | { ok: true; user: { id: string; email?: string | null } }
  | { ok: false; reason: "no_supabase" | "forbidden" };

/** Gate admin-only pages — redirects to /login when unauthenticated. */
export async function gateAdminPage(): Promise<AdminPageGate> {
  if (!hasSupabase) return { ok: false, reason: "no_supabase" };

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) return { ok: false, reason: "forbidden" };
  return { ok: true, user };
}
