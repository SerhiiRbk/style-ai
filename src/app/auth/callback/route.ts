import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { applyWelcomeCredits, PENDING_PROMO_COOKIE } from "@/lib/welcome-credits";
import { redeemPromotion } from "@/lib/promotions";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

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

  if (hasSupabaseAdmin) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const admin = createAdminSupabase();
      const cookieStore = await cookies();
      const pendingPromo = cookieStore.get(PENDING_PROMO_COOKIE)?.value ?? null;
      if (pendingPromo) {
        cookieStore.delete(PENDING_PROMO_COOKIE);
        try {
          await redeemPromotion(admin, user.id, pendingPromo);
        } catch {
          try {
            await applyWelcomeCredits(admin, user.id);
          } catch {
            // Non-fatal — balance reads also attempt the grant.
          }
        }
      } else {
        try {
          await applyWelcomeCredits(admin, user.id);
        } catch {
          // Non-fatal — balance reads also attempt the grant.
        }
      }
    }
  }

  const destination = next.startsWith("/") ? next : `/${next}`;
  return NextResponse.redirect(new URL(destination, request.url));
}
