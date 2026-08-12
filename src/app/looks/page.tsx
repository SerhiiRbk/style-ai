import { redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import {
  createServerSupabase,
  createAdminSupabase,
} from "@/lib/supabase/server";
import { listUserLookSets } from "@/lib/data/look-sets";
import { lookContextById } from "@/lib/look-contexts";
import { signedAssetProxyUrl } from "@/lib/asset-token";

export const metadata = {
  title: "Your sets · Valetti",
  description: "Every set of looks you've created with Create a Look.",
};

export default async function LooksPage() {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return (
      <main className="bg-paper">
        <Navbar />
        <div className="container-luxe max-w-3xl py-16 text-center text-stone">
          Create a Look is unavailable in demo mode.
        </div>
      </main>
    );
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/looks");

  const admin = createAdminSupabase();
  const sets = await listUserLookSets(admin, user.id);

  return (
    <main className="bg-paper">
      <Navbar />
      <div className="container-luxe max-w-5xl py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-brass">Your sets</p>
            <h1 className="mt-1 font-display text-3xl text-ink">Create a Look</h1>
          </div>
          <Link
            href="/create-look"
            className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            New set
          </Link>
        </div>

        {sets.length === 0 ? (
          <div className="mt-10 rounded-2xl border hairline bg-cream/40 p-10 text-center">
            <p className="text-stone">You haven&apos;t created any looks yet.</p>
            <Link
              href="/create-look"
              className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft"
            >
              Create your first set
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((s) => {
              const occasion = lookContextById(s.occasionId)?.label ?? "Looks";
              const date = new Date(s.createdAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <Link
                  key={s.id}
                  href={`/looks/${s.id}`}
                  className="group block overflow-hidden rounded-2xl border hairline bg-paper transition-colors hover:border-ink/30"
                >
                  <div className="aspect-[9/16] w-full bg-cream/40">
                    {s.thumbPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={signedAssetProxyUrl(s.thumbPath)}
                        alt={occasion}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-display text-lg text-ink">
                      {s.name || occasion}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-soft">{date}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
