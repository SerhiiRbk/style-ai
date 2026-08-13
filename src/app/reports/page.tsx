import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { CreateReportButton } from "@/components/CreateReportButton";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import {
  ReportsBrowser,
  type ReportsBrowserItem,
} from "@/components/ReportsBrowser";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";
import { getUserReports, tierLabel } from "@/lib/data/user-reports";
import { languageNativeLabel } from "@/lib/languages";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ReportsPage() {
  if (!hasSupabase) {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <section className="container-luxe py-24 text-center">
            <p className="eyebrow">My reports</p>
            <h1 className="mt-4 font-display text-4xl">Sign in to save reports</h1>
            <p className="mx-auto mt-4 max-w-md text-stone">
              Report history is available once authentication is configured. In
              demo mode, explore the sample report instead.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <ButtonLink href="/report/valetti-style-prospect-demo" variant="outline">
                View example
              </ButtonLink>
              <ButtonLink href="/start">Create a report</ButtonLink>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const [reports, balance] = await Promise.all([
    getUserReports(),
    getCreditBalance(),
  ]);

  const items: ReportsBrowserItem[] = (reports ?? []).map((r) => ({
    id: r.id,
    headline: r.headline || "Style report",
    date: formatDate(r.createdAt),
    thumbUrl: r.coverImage ?? null,
    tier: tierLabel(r.tier),
    language: languageNativeLabel(r.language),
    status: r.generating ? "processing" : r.status,
  }));

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe flex flex-col gap-6 py-16 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">My reports</p>
              <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
                Your style reports
              </h1>
              <p className="mt-4 max-w-xl text-stone">
                Every report you&apos;ve created — open any to review colours,
                looks, and shopping lists.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
              {balance !== null && (
                <div className="flex items-center gap-3 rounded-full border border-brass/40 bg-brass/5 px-4 py-2">
                  <span className="font-display text-lg text-ink">
                    {balance}
                  </span>
                  <span className="text-xs text-stone">credits</span>
                  <Link
                    href="/account#credits"
                    className="text-xs text-brass transition-colors hover:text-ink"
                  >
                    Manage →
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-3">
                <ViewModeToggle storageKey="reports-view-mode" />
                <ButtonLink href="/gallery" variant="outline">
                  My gallery
                </ButtonLink>
                <CreateReportButton compact label="New report" />
              </div>
            </div>
          </div>
        </section>

        <section className="container-luxe py-10">
          <ReportsBrowser reports={items} />
        </section>

        <section className="container-luxe pb-20">
          <div className="rounded-2xl border hairline bg-cream/30 p-6 sm:p-8">
            <p className="eyebrow">Account</p>
            <h2 className="mt-3 font-display text-2xl text-ink">
              Photos, credits &amp; privacy
            </h2>
            <p className="mt-2 max-w-xl text-sm text-stone">
              Manage your reference photos, credit balance, data export and
              account deletion in one place.
            </p>
            <div className="mt-5">
              <Link
                href="/account"
                className="text-sm text-brass underline-offset-2 transition-colors hover:text-ink hover:underline"
              >
                Go to your account →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
