import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { LookSetCard } from "@/components/LookSetCard";
import { CreditsProvider } from "@/components/CreditsContext";
import { ShareSetButton } from "@/components/ShareSetButton";
import { DeleteSetButton } from "@/components/DeleteSetButton";
import { getCreditBalance } from "@/lib/credits";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import {
  createServerSupabase,
  createAdminSupabase,
} from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import {
  loadLookSetById,
  loadLookSetResult,
  loadPublicLookSet,
} from "@/lib/data/look-sets";
import { lookSetOccasionLabel } from "@/lib/look-contexts";
import { lookDiffersFromOriginal } from "@/lib/look-original";
import { signedAssetProxyUrl } from "@/lib/asset-token";
import { ReportImageGenerating } from "@/components/luxe/ReportImageGenerating";
import { LookGeneratingRefresh } from "@/components/LookGeneratingRefresh";

export const metadata = { title: "Look set · Valetti" };

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

  const admin = createAdminSupabase();

  // Owner sees the full set (try-on, share, delete). Admins can open any set
  // (including private ones), same as reports. Everyone else can only view it
  // once it's shared (is_public).
  const owned = user ? await loadLookSetResult(admin, user.id, id) : null;
  const isAdmin = Boolean(user && isAdminEmail(user.email));
  const set =
    owned ??
    (isAdmin ? await loadLookSetById(admin, id) : null) ??
    (await loadPublicLookSet(admin, id));
  if (!set) notFound();

  const isOwner = owned !== null;
  const creditBalance = isOwner ? await getCreditBalance() : null;

  const occasion = lookSetOccasionLabel(set.occasionId);
  const title = set.name?.trim() || occasion;
  const date = new Date(set.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const looksGrid = (
    <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {set.looks.map((look) =>
        look.imagePath ? (
          <LookSetCard
            key={look.idx}
            setId={set.setId}
            lookIndex={look.idx}
            occasionId={set.occasionId}
            title={look.title}
            description={look.description}
            palette={look.palette}
            imageSrc={signedAssetProxyUrl(look.imagePath)}
            imageTqSrc={
              look.imagePathTq ? signedAssetProxyUrl(look.imagePathTq) : null
            }
            items={set.lookItems?.[look.idx] ?? []}
            isOwner={isOwner}
            canRevert={lookDiffersFromOriginal(
              {
                imagePath: look.imagePath,
                description: look.description,
              },
              "originalLooks" in set ? set.originalLooks?.[look.idx] : undefined,
            )}
            initialEstimate={owned?.constructEstimates?.[look.idx] ?? null}
          />
        ) : (
          <article key={look.idx} className="flex flex-col">
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border hairline bg-cream/40">
              <ReportImageGenerating
                label={look.title || "Generating look"}
                detail="Styling this look on your photo"
              />
            </div>
            {look.title ? (
              <h2 className="mt-3 font-display text-lg text-ink">{look.title}</h2>
            ) : null}
          </article>
        ),
      )}
    </div>
  );

  const readyCount = set.looks.filter((l) => l.imagePath).length;
  const generating = set.generating;

  return (
    <main className="bg-paper">
      <LookGeneratingRefresh active={generating} />
      <Navbar />
      <div className="container-luxe max-w-5xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-brass">{occasion}</p>
            <h1 className="mt-1 font-display text-3xl text-ink">{title}</h1>
            <p className="mt-1 text-sm text-stone-soft">
              {date} ·{" "}
              {generating
                ? `${readyCount} of ${set.looks.length} looks`
                : `${readyCount} looks`}
              {isAdmin && !isOwner ? " · Admin view" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner ? (
              <>
                <ShareSetButton
                  setId={set.setId}
                  initialIsPublic={owned!.isPublic}
                />
                {set.reportId ? (
                  <Link
                    href={`/report/${set.reportId}`}
                    className="rounded-full border border-line px-4 py-2 text-sm text-stone transition-colors hover:border-ink/30 hover:text-ink"
                  >
                    Open report
                  </Link>
                ) : (
                  <DeleteSetButton setId={set.setId} redirectTo="/looks" />
                )}
                <Link
                  href="/looks"
                  className="rounded-full border border-line px-4 py-2 text-sm text-stone transition-colors hover:border-ink/30 hover:text-ink"
                >
                  All looks
                </Link>
              </>
            ) : isAdmin ? (
              <Link
                href="/admin/looks"
                className="rounded-full border border-line px-4 py-2 text-sm text-stone transition-colors hover:border-ink/30 hover:text-ink"
              >
                All looks
              </Link>
            ) : (
              <Link
                href="/create-look"
                className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper transition-colors hover:bg-ink-soft"
              >
                Create your own looks
              </Link>
            )}
          </div>
        </div>

        {set.carloNote ? (
          <blockquote className="mt-6 rounded-2xl border hairline bg-cream/40 p-5 text-stone">
            <p className="text-sm leading-relaxed">{set.carloNote}</p>
            <footer className="mt-2 text-xs uppercase tracking-wide text-stone-soft">
              — Carlo
            </footer>
          </blockquote>
        ) : null}

        {isOwner ? (
          <CreditsProvider initialBalance={creditBalance}>
            {looksGrid}
          </CreditsProvider>
        ) : (
          looksGrid
        )}
      </div>
    </main>
  );
}
