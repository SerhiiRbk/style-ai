import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { LooksBrowser, type LooksBrowserItem } from "@/components/LooksBrowser";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import {
  createServerSupabase,
  createAdminSupabase,
} from "@/lib/supabase/server";
import { listUserLookSets } from "@/lib/data/look-sets";
import { ensureUserReportLookSets } from "@/lib/data/report-look-sets";
import { lookSetOccasionLabel } from "@/lib/look-contexts";
import { signedAssetProxyUrl } from "@/lib/asset-token";

export const metadata = {
  title: "Looks · Valetti",
  description: "Every look you've created — reports and Create a Look.",
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
  await ensureUserReportLookSets(admin, user.id);
  const sets = await listUserLookSets(admin, user.id);

  const items: LooksBrowserItem[] = sets.map((s) => {
    const occasion = lookSetOccasionLabel(s.occasionId);
    const date = new Date(s.createdAt).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return {
      id: s.id,
      name: s.name || occasion,
      occasion,
      canDelete: !s.reportId,
      date,
      thumbUrl: s.thumbPath ? signedAssetProxyUrl(s.thumbPath) : null,
      generating: s.generating,
    };
  });

  return (
    <main className="bg-paper">
      <Navbar />
      <div className="container-luxe max-w-5xl py-10">
        <LooksBrowser sets={items} />
      </div>
    </main>
  );
}
