import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Browser Supabase client (anon key, subject to RLS). */
export function createClient() {
  return createBrowserClient(env.supabaseUrl!, env.supabaseAnonKey!);
}
