"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseAdmin } from "@/lib/env";
import { LEGAL } from "@/lib/legal";
import { absoluteAuthUrl } from "@/lib/site-url";
import { redeemPromotion } from "@/lib/promotions";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

const PENDING_PROMO_COOKIE = "pending_promo";

/** Only allow same-origin relative paths (blocks open redirects). */
function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? ""));
  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const qs = next
      ? `&next=${encodeURIComponent(next)}`
      : "";
    redirect(`/login?error=${encodeURIComponent(error.message)}${qs}`);
  }

  const cookieStore = await cookies();
  const pendingPromo = cookieStore.get(PENDING_PROMO_COOKIE)?.value;
  if (pendingPromo && data.user && hasSupabaseAdmin) {
    cookieStore.delete(PENDING_PROMO_COOKIE);
    try {
      const admin = createAdminSupabase();
      const result = await redeemPromotion(admin, data.user.id, pendingPromo);
      redirect(
        `/start?promo=ok&credits=${result.credits}&balance=${result.balance}`,
      );
    } catch {
      redirect(`/start?promo=failed&code=${encodeURIComponent(pendingPromo)}`);
    }
  }

  redirect(next ?? "/start");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const acceptTerms = formData.get("acceptTerms");

  if (acceptTerms !== "on") {
    redirect(
      `/login?error=${encodeURIComponent("You must accept the Terms of Service and Privacy Policy to create an account.")}`,
    );
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await absoluteAuthUrl(
        `/auth/callback?next=${encodeURIComponent("/start?welcome=1")}`,
      ),
    },
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user && hasSupabaseAdmin) {
    try {
      await createAdminSupabase().from("consents").insert({
        user_id: data.user.id,
        type: "terms",
        version: LEGAL.termsVersion,
      });
    } catch {
      // Non-fatal — account was created; terms acceptance can be re-verified later.
    }
  }

  redirect("/login?check=1");
}

export async function signOut() {
  const sb = await createServerSupabase();
  await sb.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(
      `/login/forgot-password?error=${encodeURIComponent("Enter your email address.")}`,
    );
  }

  const sb = await createServerSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: await absoluteAuthUrl("/auth/callback?next=/login/reset-password"),
  });
  if (error) {
    redirect(
      `/login/forgot-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect("/login/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    redirect(
      `/login/reset-password?error=${encodeURIComponent("Password must be at least 8 characters.")}`,
    );
  }
  if (password !== confirm) {
    redirect(
      `/login/reset-password?error=${encodeURIComponent("Passwords do not match.")}`,
    );
  }

  const sb = await createServerSupabase();
  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    redirect(
      `/login/reset-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  await sb.auth.signOut();
  redirect("/login?reset=1");
}
