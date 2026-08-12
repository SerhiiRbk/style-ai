import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import {
  createServerSupabase,
  createAdminSupabase,
} from "@/lib/supabase/server";
import { loadLookSetResult } from "@/lib/data/look-sets";
import { lookContextById } from "@/lib/look-contexts";
import { signedAssetProxyUrl } from "@/lib/asset-token";

export const metadata = { title: "Your look set · Valetti" };

export default async function LookSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!hasSupabase || !hasSupabaseAdmin) notFound();

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=/looks/${id}`);

  const admin = createAdminSupabase();
  const set = await loadLookSetResult(admin, user.id, id);
  if (!set) notFound();

  const occasion = lookContextById(set.occasionId)?.label ?? "Looks";
  const date = new Date(set.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <main className="bg-paper">
      <Navbar />
      <div className="container-luxe max-w-5xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-brass">{occasion}</p>
            <h1 className="mt-1 font-display text-3xl text-ink">
              {occasion}
            </h1>
            <p className="mt-1 text-sm text-stone-soft">
              {date} · {set.looks.length} looks
            </p>
          </div>
          <Link
            href="/looks"
            className="rounded-full border border-line px-4 py-2 text-sm text-stone transition-colors hover:border-ink/30 hover:text-ink"
          >
            All sets
          </Link>
        </div>

        {set.carloNote ? (
          <blockquote className="mt-6 rounded-2xl border hairline bg-cream/40 p-5 text-stone">
            <p className="text-sm leading-relaxed">{set.carloNote}</p>
            <footer className="mt-2 text-xs uppercase tracking-wide text-stone-soft">
              — Carlo
            </footer>
          </blockquote>
        ) : null}

        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {set.looks.map((look, i) => (
            <article key={i} className="flex flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedAssetProxyUrl(look.imagePath)}
                alt={look.title}
                className="aspect-[9/16] w-full rounded-2xl border hairline object-cover"
              />
              <h2 className="mt-3 font-display text-lg text-ink">
                {look.title}
              </h2>
              <p className="mt-1 text-sm text-stone">{look.description}</p>
              {look.palette?.length ? (
                <div className="mt-3 flex gap-1.5">
                  {look.palette.map((hex, k) => (
                    <span
                      key={k}
                      title={hex}
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
