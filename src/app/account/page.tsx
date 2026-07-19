import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { MyPhotosManager } from "@/components/MyPhotosManager";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { ExportDataButton } from "@/components/ExportDataButton";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  if (!hasSupabase) {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <section className="container-luxe py-24 text-center">
            <p className="eyebrow">Account</p>
            <h1 className="mt-4 font-display text-4xl">Sign in to manage your account</h1>
            <div className="mt-8">
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

  const balance = await getCreditBalance();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-16">
            <p className="eyebrow">Account</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              Your account
            </h1>
            <p className="mt-4 max-w-xl text-stone">
              Your credits, reference photos, and privacy controls — all in one
              place.
            </p>
            <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone">
              <a href="#credits" className="transition-colors hover:text-ink">Credits</a>
              <a href="#photos" className="transition-colors hover:text-ink">Photos</a>
              <a href="#privacy" className="transition-colors hover:text-ink">Privacy &amp; data</a>
            </nav>
          </div>
        </section>

        {/* Credits */}
        <section id="credits" className="container-luxe scroll-mt-24 py-10">
          <div className="rounded-2xl border hairline bg-paper p-6 sm:p-8">
            <p className="eyebrow">Credits</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-4xl text-ink">
                  {balance ?? 0}
                </span>
                <span className="text-sm text-stone">credits available</span>
              </div>
              <ButtonLink href="/pricing" variant="outline">
                View plans &amp; credits
              </ButtonLink>
            </div>
            <p className="mt-3 text-sm text-stone">
              Credits never expire and there&apos;s no subscription — top up only
              when you want a new report or try-on.
            </p>
          </div>
        </section>

        {/* Photos */}
        <section id="photos" className="container-luxe scroll-mt-24 pb-10">
          <div className="rounded-2xl border hairline bg-paper p-6 sm:p-8">
            <p className="eyebrow">Photos</p>
            <h2 className="mt-3 font-display text-2xl text-ink">
              Your reference photos
            </h2>
            <p className="mt-2 max-w-xl text-sm text-stone">
              Private to you and used for virtual try-on. Choose a default model,
              upload new photos, or delete any you no longer want us to keep.
            </p>
            <div className="mt-6">
              <MyPhotosManager />
            </div>
          </div>
        </section>

        {/* Privacy & data */}
        <section id="privacy" className="container-luxe scroll-mt-24 pb-20">
          <div className="rounded-2xl border hairline bg-cream/30 p-6 sm:p-8">
            <p className="eyebrow">Privacy &amp; data</p>
            <h2 className="mt-3 font-display text-2xl text-ink">
              Your GDPR rights
            </h2>
            <p className="mt-2 max-w-xl text-sm text-stone">
              Download a structured copy of the personal data we hold about your
              account, or permanently erase everything.
            </p>
            <div className="mt-5">
              <ExportDataButton />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-red-100 bg-red-50/30 p-6 sm:p-8">
            <h2 className="font-display text-2xl text-ink">Delete your account</h2>
            <p className="mt-2 max-w-xl text-sm text-stone">
              Permanently erase your account and all associated data — every
              report, generated image, uploaded photo, try-on and credit record.
              This cannot be undone.
            </p>
            <div className="mt-5">
              <DeleteAccountButton />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
