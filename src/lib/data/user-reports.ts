import "server-only";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { reportGenerationState } from "@/lib/data/reports";
import type {
  AccessoryRec,
  HeadwearRec,
  EyewearRec,
  FacialHairRec,
  HairRec,
  Tier,
} from "@/lib/report";
export { tierLabel, reportStatusLabel } from "@/lib/report-labels";

export type UserReportSummary = {
  id: string;
  createdAt: string;
  headline: string | null;
  tier: Tier;
  status: "processing" | "ready" | "failed";
  /**
   * True while the report is still producing images in the background — the DB
   * status can be "ready" (written content saved) while look / hair / capsule
   * photos are still generating. Mirrors the report page's spinner.
   */
  generating: boolean;
};

type SummaryRow = {
  id: string;
  created_at: string;
  headline: string | null;
  tier: Tier | null;
  status: string | null;
  hair: { recommend: HairRec[]; avoid: HairRec[] } | null;
  facial_hair: FacialHairRec[] | null;
  eyewear: EyewearRec[] | null;
  accessories: AccessoryRec[] | null;
  headwear: HeadwearRec[] | null;
  capsule_images: (string | null)[] | null;
};

/**
 * Fetch the signed-in user's reports with a `generating` flag derived from the
 * same logic the report page uses (missing look / hair / capsule images), so a
 * report mid-image-generation isn't shown as "Ready".
 */
export async function getUserReports(): Promise<UserReportSummary[] | null> {
  if (!hasSupabase) return null;

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  // Owner reads its own rows; use the admin client (like the report page) so the
  // reference-photo check for hair/grooming phases is accurate.
  const db = hasSupabaseAdmin ? createAdminSupabase() : sb;

  const { data, error } = await db
    .from("reports")
    .select(
      "id, created_at, headline, tier, status, hair, facial_hair, eyewear, accessories, headwear, capsule_images",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as SummaryRow[];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);

  const [{ data: looks }, { data: photos }] = await Promise.all([
    db.from("looks").select("report_id, image_path").in("report_id", ids),
    db.from("photos").select("id").eq("user_id", user.id).limit(1),
  ]);

  const hasReferencePhoto = (photos?.length ?? 0) > 0;
  const looksByReport = new Map<string, { image_path?: string | null }[]>();
  for (const l of looks ?? []) {
    const rid = l.report_id as string;
    const arr = looksByReport.get(rid) ?? [];
    arr.push({ image_path: l.image_path as string | null });
    looksByReport.set(rid, arr);
  }

  return rows.map((row) => {
    const state = reportGenerationState(
      {
        status: row.status,
        tier: row.tier,
        capsule_images: row.capsule_images,
        hair: row.hair,
        facial_hair: row.facial_hair,
        eyewear: row.eyewear,
        accessories: row.accessories,
        headwear: row.headwear,
      },
      looksByReport.get(row.id) ?? [],
      { hasReferencePhoto },
    );
    return {
      id: row.id,
      createdAt: row.created_at,
      headline: row.headline ?? null,
      tier: row.tier ?? "basic",
      status:
        row.status === "processing" || row.status === "failed"
          ? row.status
          : "ready",
      generating: state.pending && state.status !== "failed",
    };
  });
}
