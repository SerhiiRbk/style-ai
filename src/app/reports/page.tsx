import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";
import {
  getUserReports,
  reportStatusLabel,
  tierLabel,
} from "@/lib/data/user-reports";

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
              <ButtonLink href="/report/demo" variant="outline">
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
                    href="/pricing"
                    className="text-xs text-brass transition-colors hover:text-ink"
                  >
                    Buy more →
                  </Link>
                </div>
              )}
              <ButtonLink href="/start">New report</ButtonLink>
            </div>
          </div>
        </section>

        <section className="container-luxe py-10">
          {!reports?.length ? (
            <div className="rounded-2xl border hairline bg-paper px-6 py-16 text-center">
              <p className="font-display text-2xl">No reports yet</p>
              <p className="mx-auto mt-3 max-w-sm text-stone">
                Create your first style report — it only takes a few minutes.
              </p>
              <div className="mt-8">
                <ButtonLink href="/start">Create your first report</ButtonLink>
              </div>
            </div>
          ) : (
            <ul className="divide-y hairline rounded-2xl border hairline bg-paper">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/report/${r.id}`}
                    prefetch={false}
                    className="group flex w-full flex-col gap-3 px-5 py-5 transition-colors hover:bg-cream/30 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg text-ink group-hover:text-ink-soft">
                        {r.headline || "Style report"}
                      </p>
                      <p className="mt-1 text-sm text-stone">
                        {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-full border hairline bg-cream/40 px-3 py-1 text-xs text-stone">
                        {tierLabel(r.tier)}
                      </span>
                      <StatusBadge status={r.status} />
                      <span
                        className="hidden text-sm text-brass transition-colors group-hover:text-ink sm:inline"
                        aria-hidden
                      >
                        Open →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function StatusBadge({
  status,
}: {
  status: "processing" | "ready" | "failed";
}) {
  const label = reportStatusLabel(status);
  const styles =
    status === "processing"
      ? "border-brass/30 bg-brass/10 text-brass"
      : status === "failed"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-ink/10 bg-cream/60 text-ink";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${styles}`}
    >
      {status === "processing" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brass align-middle" />
      )}
      {label}
    </span>
  );
}
