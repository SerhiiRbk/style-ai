"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { BRAND } from "@/lib/brand";
import {
  CREDIT_COSTS,
  REPORT_COST,
  SIGNUP_BONUS,
} from "@/lib/credit-costs";

function greetingName(email?: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  const part = local.split(/[._+-]/)[0]?.trim();
  if (!part || part.length < 2) return null;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

export function WelcomeScreen({
  email,
  creditBalance,
  onStartReport,
}: {
  email?: string | null;
  creditBalance: number | null;
  onStartReport: () => void;
}) {
  const name = greetingName(email);
  const credits = creditBalance ?? SIGNUP_BONUS;
  const afterStarter = Math.max(0, credits - REPORT_COST.free);

  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-8">
      <div className="rounded-2xl border hairline bg-gradient-to-b from-cream/80 to-paper p-8 sm:p-10">
        <p className="eyebrow text-brass">Account confirmed</p>
        <h1 className="mt-4 font-display text-3xl leading-tight text-ink sm:text-4xl">
          {name ? `Welcome, ${name}` : `Welcome to ${BRAND.name}`}
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-stone">
          Your private style atelier is ready. Choose how you&apos;d like to
          begin — most people start with a Starter Report using their welcome
          credits.
        </p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-brass/30 bg-brass/5 px-5 py-3">
          <span className="font-display text-3xl text-ink">{credits}</span>
          <span className="text-left text-sm leading-snug text-stone">
            credits in your account
            <span className="mt-0.5 block text-xs text-stone-soft">
              Starter Report {REPORT_COST.free} cr · try-on {CREDIT_COSTS.tryon}{" "}
              cr
              {afterStarter > 0
                ? ` · ${afterStarter} left after your first report`
                : null}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="group flex flex-col rounded-2xl border hairline bg-paper p-6 transition-colors hover:border-ink/20">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-brass">
            Recommended
          </p>
          <h2 className="mt-3 font-display text-xl text-ink">
            Create your first report
          </h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-stone">
            Upload a portrait and full-length photo, share your goals, and{" "}
            {BRAND.stylist.first} will build your personalised style profile in
            about two minutes.
          </p>
          <button
            type="button"
            onClick={onStartReport}
            className="mt-6 w-full rounded-full bg-ink px-6 py-3 text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            Start my report →
          </button>
        </article>

        <article className="flex flex-col rounded-2xl border hairline bg-paper/60 p-6 transition-colors hover:border-ink/20">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-soft">
            When you need more
          </p>
          <h2 className="mt-3 font-display text-xl text-ink">
            Top up your balance
          </h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-stone">
            Unlock Basic, Lookbook or Premium reports — more looks, PDF export,
            capsule wardrobe and premium grooming previews. Credits never
            expire.
          </p>
          <ButtonLink
            href="/pricing"
            variant="outline"
            className="mt-6 w-full"
          >
            View credit packs
          </ButtonLink>
        </article>
      </div>

      <p className="mt-8 text-center text-xs text-stone-soft">
        Questions about how it works?{" "}
        <Link href="/" className="text-brass hover:text-ink">
          See the homepage tour
        </Link>
        {" · "}
        <Link href="/reports" className="text-brass hover:text-ink">
          Your reports
        </Link>
      </p>
    </div>
  );
}
