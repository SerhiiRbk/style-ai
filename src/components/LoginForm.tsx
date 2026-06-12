"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn, signUp } from "@/app/login/actions";

export function LoginForm({ next }: { next?: string }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <form className="mt-7 space-y-4">
      {safeNext ? <input type="hidden" name="next" value={safeNext} /> : null}
      <Input name="email" type="email" placeholder="you@email.com" label="Email" />
      <Input
        name="password"
        type="password"
        placeholder="••••••••"
        label="Password"
      />

      <p className="text-right">
        <Link
          href="/login/forgot-password"
          className="text-xs text-brass hover:text-ink"
        >
          Forgot password?
        </Link>
      </p>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border hairline bg-cream/40 p-4">
        <input
          type="checkbox"
          name="acceptTerms"
          value="on"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-ink)]"
        />
        <span className="text-xs leading-relaxed text-stone">
          I agree to the{" "}
          <Link href="/terms" className="text-brass hover:text-ink">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-brass hover:text-ink">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          formAction={signIn}
          className="flex-1 rounded-full bg-ink px-6 py-3 text-sm text-paper transition-colors hover:bg-ink-soft"
        >
          Sign in
        </button>
        <button
          type="submit"
          formAction={signUp}
          disabled={!termsAccepted}
          className="flex-1 rounded-full border border-ink/25 px-6 py-3 text-sm text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create account
        </button>
      </div>

      <p className="text-xs text-stone-soft">
        The Terms checkbox is required to create an account. Photo processing
        requires separate consent when you upload images to generate a report.
      </p>
    </form>
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
