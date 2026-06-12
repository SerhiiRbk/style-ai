import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";

/** Exchange Supabase auth codes (email confirm, password recovery, OAuth). */
export async function GET(request: Request) {
  if (!hasSupabase) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/start";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Invalid or expired sign-in link.")}`,
        request.url,
      ),
    );
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Could not verify the link. Request a new one and try again.")}`,
        request.url,
      ),
    );
  }

  const destination = next.startsWith("/") ? next : `/${next}`;
  return NextResponse.redirect(new URL(destination, request.url));
}
