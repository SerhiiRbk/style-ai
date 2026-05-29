import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Server Supabase client bound to the request cookies (RLS-enforced, acts as
 * the signed-in user). Use in Server Components, Route Handlers, Server Actions.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore; middleware refreshes.
        }
      },
    },
  });
}

/**
 * Service-role client that bypasses RLS. SERVER-ONLY — never import in client
 * code. Used by the generation pipeline to write reports/looks for a user.
 */
export function createAdminSupabase() {
  return createAdmin(env.supabaseUrl!, env.supabaseServiceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
