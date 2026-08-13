import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { GalleryView } from "@/components/GalleryView";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserGallery } from "@/lib/data/user-gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Images",
  robots: { index: false, follow: false },
};

export default async function GalleryPage() {
  if (!hasSupabase) {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <section className="container-luxe py-24 text-center">
            <p className="eyebrow">My Images</p>
            <h1 className="mt-4 font-display text-4xl">
              Sign in to see your looks
            </h1>
            <p className="mx-auto mt-4 max-w-md text-stone">
              Your generated looks appear here once authentication is
              configured. In demo mode, explore the sample report instead.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <ButtonLink
                href="/report/valetti-style-prospect-demo"
                variant="outline"
              >
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

  const groups = await getUserGallery();
  const hasItems = Boolean(groups?.length);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-16">
            <p className="eyebrow">My Images</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              Your style gallery
            </h1>
            <p className="mt-4 max-w-xl text-stone">
              Every look, capsule and grooming preview we&apos;ve generated
              across your reports — in one place.
            </p>
          </div>
        </section>

        <section className="container-luxe py-10">
          {!hasItems ? (
            <div className="rounded-2xl border hairline bg-paper px-6 py-16 text-center">
              <p className="font-display text-2xl">No looks yet</p>
              <p className="mx-auto mt-3 max-w-sm text-stone">
                Create a style report and your generated looks will collect
                here as they&apos;re ready.
              </p>
              <div className="mt-8">
                <ButtonLink href="/start">Create your first report</ButtonLink>
              </div>
            </div>
          ) : (
            <GalleryView groups={groups!} />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
