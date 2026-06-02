import Link from "next/link";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { signIn, signUp } from "./actions";
import { ButtonLink } from "@/components/Button";
import { BRAND } from "@/lib/brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check?: string }>;
}) {
  const sp = await searchParams;

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

      {sp.check && (
        <p className="mt-4 rounded-lg border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink">
          Check your inbox to confirm your email, then sign in.
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-lg border border-[#9E5C3C]/40 bg-[#9E5C3C]/5 px-4 py-3 text-sm text-[#9E5C3C]">
          {sp.error}
        </p>
      )}

      <form className="mt-7 space-y-4">
        <Input name="email" type="email" placeholder="you@email.com" label="Email" />
        <Input
          name="password"
          type="password"
          placeholder="••••••••"
          label="Password"
        />
        <div className="flex gap-3 pt-2">
          <button
            formAction={signIn}
            className="flex-1 rounded-full bg-ink px-6 py-3 text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            Sign in
          </button>
          <button
            formAction={signUp}
            className="flex-1 rounded-full border border-ink/25 px-6 py-3 text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Create account
          </button>
        </div>
      </form>

      <p className="mt-6 text-xs text-stone-soft">
        By continuing you consent to the processing of your photos for the
        purpose of generating your style report. You can delete your data at any
        time.
      </p>
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

function Input({
  name,
  type,
  placeholder,
  label,
}: {
  name: string;
  type: string;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-stone">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        className="mt-1.5 w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
      />
    </label>
  );
}
