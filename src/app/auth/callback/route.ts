import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { LEGAL } from "@/lib/legal";
import { applyWelcomeCredits, PENDING_PROMO_COOKIE } from "@/lib/welcome-credits";
import { linkAnonToUser } from "@/lib/events";
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
  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Could not verify the link. Request a new one and try again.")}`,
        request.url,
      ),
    );
  }

  if (hasSupabaseAdmin) {
    // Prefer the user from the exchange — getUser() in the same request can
    // still be empty before the session cookies are visible.
    const user =
      exchanged.user ?? (await supabase.auth.getUser()).data.user ?? null;
    if (user) {
      const admin = createAdminSupabase();
      const cookieStore = await cookies();
      const pendingPromo = cookieStore.get(PENDING_PROMO_COOKIE)?.value ?? null;
      if (pendingPromo) cookieStore.delete(PENDING_PROMO_COOKIE);

      try {
        await applyWelcomeCredits(admin, user.id, pendingPromo);
      } catch (err) {
        console.error("[auth/callback] welcome credits failed", user.id, err);
      }

      try {
        const { data: termsConsent } = await admin
          .from("consents")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "terms")
          .maybeSingle();
        if (!termsConsent) {
          await admin.from("consents").insert({
            user_id: user.id,
            type: "terms",
            version: LEGAL.termsVersion,
          });
        }
      } catch {
        // Non-fatal — account access still works; terms can be re-verified later.
      }

      // Stitch the anonymous funnel to this account (§5.2 п.7).
      await linkAnonToUser(
        user.id,
        cookieStore.get("valetti_anon")?.value ?? null,
      );
    }
  }

  const destination = next.startsWith("/") ? next : `/${next}`;
  return NextResponse.redirect(new URL(destination, request.url));
}
