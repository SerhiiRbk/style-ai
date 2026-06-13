import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { normalizePromoCode, PENDING_PROMO_COOKIE } from "@/lib/promotions";
import { createServerSupabase } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/Button";
import { LoginForm } from "@/components/LoginForm";
import { BRAND } from "@/lib/brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check?: string; promo?: string; reset?: string; next?: string }>;
}) {
  const sp = await searchParams;

  if (sp.promo) {
    const cookieStore = await cookies();
    cookieStore.set(PENDING_PROMO_COOKIE, normalizePromoCode(sp.promo), {
      maxAge: 7 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  // Demo mode: no auth backend — point users straight to the flow.
  if (!hasSupabase) {
    return (
      <Centered>
        <p className="eyebrow">Demo mode</p>
        <h1 className="mt-3 font-display text-3xl">Authentication is disabled</h1>
        <p className="mt-3 text-stone">
          No Supabase keys are configured, so the app runs the deterministic demo
          pipeline without accounts. Add keys from <code>.env.example</code> to
          enable real auth, storage and AI.
        </p>
        <div className="mt-6">
          <ButtonLink href="/start">Continue to the demo</ButtonLink>
        </div>
      </Centered>
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect("/start");

  return (
    <Centered>
      <Link href="/" className="font-display text-2xl">
        {BRAND.name}
      </Link>
      <h1 className="mt-8 font-display text-3xl">Create your account</h1>
      <p className="mt-2 text-stone">
        Sign in or sign up to generate your private style report.
      </p>

      {sp.promo && (
        <p className="mt-4 rounded-lg border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink">
          Promo <code className="font-medium">{normalizePromoCode(sp.promo)}</code>{" "}
          will be applied when you sign in or create an account.
        </p>
      )}
      {sp.check && (
        <p className="mt-4 rounded-lg border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink">
          Check your inbox to confirm your email, then sign in — your promo code
          will apply on first sign-in.
        </p>
      )}
      {sp.reset && (
        <p className="mt-4 rounded-lg border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink">
          Your password was updated. Sign in with your new password.
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-lg border border-[#9E5C3C]/40 bg-[#9E5C3C]/5 px-4 py-3 text-sm text-[#9E5C3C]">
          {sp.error}
        </p>
      )}

      <LoginForm next={sp.next} />
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
