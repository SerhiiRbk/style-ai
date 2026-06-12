import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { BRAND } from "@/lib/brand";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  if (!hasSupabase) redirect("/login");

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    redirect(
      `/login/forgot-password?error=${encodeURIComponent("Reset link expired or invalid. Request a new one.")}`,
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display text-2xl">
          {BRAND.name}
        </Link>
        <h1 className="mt-8 font-display text-3xl">Choose a new password</h1>
        <p className="mt-2 text-stone">
          Signed in as <span className="text-ink">{user.email}</span>. Enter your
          new password below.
        </p>

        {sp.error ? (
          <p className="mt-4 rounded-lg border border-[#9E5C3C]/40 bg-[#9E5C3C]/5 px-4 py-3 text-sm text-[#9E5C3C]">
            {sp.error}
          </p>
        ) : null}

        <ResetPasswordForm />
      </div>
    </main>
  );
}
