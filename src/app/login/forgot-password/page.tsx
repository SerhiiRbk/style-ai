import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { requestPasswordReset } from "@/app/login/actions";
import { BRAND } from "@/lib/brand";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const sp = await searchParams;

  if (!hasSupabase) redirect("/login");

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect("/start");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display text-2xl">
          {BRAND.name}
        </Link>
        <h1 className="mt-8 font-display text-3xl">Reset your password</h1>
        <p className="mt-2 text-stone">
          Enter the email for your account. We&apos;ll send a link to choose a
          new password.
        </p>

        {sp.sent ? (
          <p className="mt-4 rounded-lg border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink">
            If an account exists for that email, you&apos;ll receive a reset
            link shortly. Check your spam folder if it doesn&apos;t arrive within
            a few minutes.
          </p>
        ) : null}
        {sp.error ? (
          <p className="mt-4 rounded-lg border border-[#9E5C3C]/40 bg-[#9E5C3C]/5 px-4 py-3 text-sm text-[#9E5C3C]">
            {sp.error}
          </p>
        ) : null}

        {!sp.sent ? (
          <form action={requestPasswordReset} className="mt-7 space-y-4">
            <label className="block">
              <span className="text-sm text-stone">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@email.com"
                className="mt-1.5 w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-6 py-3 text-sm text-paper transition-colors hover:bg-ink-soft"
            >
              Send reset link
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-center text-sm text-stone">
          <Link href="/login" className="text-brass hover:text-ink">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
