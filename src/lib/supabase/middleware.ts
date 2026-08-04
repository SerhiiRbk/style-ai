import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, hasSupabase } from "@/lib/env";

/** Stable anonymous visitor id — set server-side so it's readable at the auth
 * callback for anon→user funnel stitching (§5.2 п.7). Not a fingerprint: a plain
 * cookie the visitor can clear. Non-httpOnly so the client reuses the same id. */
const ANON_COOKIE = "valetti_anon";

/** Refreshes the Supabase auth session cookie on each request. No-op in demo mode. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Bootstrap the anon id before anything else so even a cold /start visitor
  // (redirected straight to /login) already carries one for `start_gated`.
  // Written on the final response below, since Supabase's setAll may rebuild it.
  const existingAnon = request.cookies.get(ANON_COOKIE)?.value;
  const anonId = existingAnon ?? crypto.randomUUID();
  if (!existingAnon) request.cookies.set(ANON_COOKIE, anonId);

  const setAnonCookie = () => {
    if (existingAnon) return;
    response.cookies.set(ANON_COOKIE, anonId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
      secure: true,
    });
  };

  if (!hasSupabase) {
    setAnonCookie();
    return response;
  }

  const supabase = createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the user to trigger token refresh when needed.
  await supabase.auth.getUser();

  setAnonCookie();
  return response;
}
