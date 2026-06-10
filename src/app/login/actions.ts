"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseAdmin } from "@/lib/env";
import { redeemPromotion } from "@/lib/promotions";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

const PENDING_PROMO_COOKIE = "pending_promo";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
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

  redirect("/start");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const sb = await createServerSupabase();
  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/login?check=1");
}

export async function signOut() {
  const sb = await createServerSupabase();
  await sb.auth.signOut();
  redirect("/");
}
