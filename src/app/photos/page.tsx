import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ButtonLink } from "@/components/Button";
import { MyPhotosManager } from "@/components/MyPhotosManager";
import { hasSupabase } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My photos",
  robots: { index: false, follow: false },
};

export default async function PhotosPage() {
  if (!hasSupabase) {
    return (
      <>
        <Navbar />
        <main className="flex-1">
          <section className="container-luxe py-24 text-center">
            <p className="eyebrow">My photos</p>
            <h1 className="mt-4 font-display text-4xl">
              Sign in to manage photos
            </h1>
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

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="border-b hairline bg-cream/40">
          <div className="container-luxe py-16">
            <p className="eyebrow">My photos</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              Your reference photos
            </h1>
            <p className="mt-4 max-w-xl text-stone">
              These full-length photos are private to you and power virtual
              try-on. Choose a default model, upload new photos, or delete any
              you no longer want us to keep.
            </p>
          </div>
        </section>

        <section className="container-luxe py-10">
          <MyPhotosManager />
        </section>
      </main>
      <Footer />
    </>
  );
}
