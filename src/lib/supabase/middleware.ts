import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, hasSupabase } from "@/lib/env";
import {
  ATTR_COOKIE,
  compactAttribution,
  isReportId,
  mergeAttribution,
  parseAttributionCookie,
  parseAttributionFromSearch,
  serializeAttributionCookie,
} from "@/lib/funnel";

/** Stable anonymous visitor id — set server-side so it's readable at the auth
 * callback for anon→user funnel stitching (§5.2 п.7). Not a fingerprint: a plain
 * cookie the visitor can clear. Non-httpOnly so the client reuses the same id. */
const ANON_COOKIE = "valetti_anon";

function firstTouchAttribution(request: NextRequest): string | null {
  const incoming = parseAttributionFromSearch(request.nextUrl.searchParams);
  const pathId = request.nextUrl.pathname.match(
    /^\/report\/([0-9a-f-]{36})/i,
  )?.[1];
  if (isReportId(pathId) && !incoming.referrer_report_id) {
    incoming.referrer_report_id = pathId;
  }
  const existing = parseAttributionCookie(request.cookies.get(ATTR_COOKIE)?.value);
  const merged = mergeAttribution(existing, incoming);
  if (Object.keys(compactAttribution(merged)).length === 0) return null;
  const serialized = serializeAttributionCookie(merged);
  if (serialized === serializeAttributionCookie(existing)) return null;
  return serialized;
}

/** Refreshes the Supabase auth session cookie on each request. No-op in demo mode. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Bootstrap the anon id before anything else so even a cold /start visitor
  // (redirected straight to /login) already carries one for `start_gated`.
  // Written on the final response below, since Supabase's setAll may rebuild it.
  const existingAnon = request.cookies.get(ANON_COOKIE)?.value;
  const anonId = existingAnon ?? crypto.randomUUID();
  if (!existingAnon) request.cookies.set(ANON_COOKIE, anonId);
  const nextAttr = firstTouchAttribution(request);

  const setVisitorCookies = () => {
    if (!existingAnon) {
      response.cookies.set(ANON_COOKIE, anonId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        httpOnly: false,
        secure: true,
      });
    }
    if (nextAttr) {
      response.cookies.set(ATTR_COOKIE, nextAttr, {
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
        sameSite: "lax",
        httpOnly: false,
        secure: true,
      });
    }
  };

  if (!hasSupabase) {
    setVisitorCookies();
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

  setVisitorCookies();
  return response;
}
