import { NextResponse } from "next/server";
import { hasSupabase, hasAI, hasSupabaseAdmin } from "@/lib/env";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { isDemoReportId } from "@/lib/demo-report";
import {
  CREDIT_COSTS,
  creditBalance,
  spendCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import {
  assembleReport,
  type AccessoryRec,
  type ColorRec,
  type EyewearRec,
  type FacialHairRec,
  type HairRec,
  type HeadwearRec,
  type ShoppingItem,
  type Tier,
} from "@/lib/report";
import { buildExtras } from "@/lib/style-extras";
import { enrichShoppingImages } from "@/lib/data/catalog";
import type { StyleProfile } from "@/lib/style-profile";
import { translateReportParts } from "@/lib/ai/translate-report";
import { isReportLanguage, normalizeLanguage } from "@/lib/languages";

export const maxDuration = 300;

type LookRow = {
  id: string;
  context: string | null;
  title: string | null;
  description: string | null;
  palette: string[] | null;
};

/**
 * Re-translate an existing report's textual content into a different language
 * and charge `CREDIT_COSTS.language_change` once the translation succeeds.
 * Recommendations/images are unchanged — only prose is localised.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSupabase) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }
  if (!hasAI) {
    return NextResponse.json(
      { error: "Translation is not configured" },
      { status: 501 },
    );
  }

  const { id: reportId } = await params;
  if (!reportId || isDemoReportId(reportId)) {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const target = body?.language;
  if (!isReportLanguage(target)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: row } = await admin
    .from("reports")
    .select(
      "id, user_id, tier, status, language, profile, colors, hair, silhouette, headline, summary, shopping, do_list, dont_list, look_items, facial_hair, eyewear, accessories, headwear",
    )
    .eq("id", reportId)
    .single();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (row.status !== "ready") {
    return NextResponse.json({ error: "Report not ready" }, { status: 409 });
  }
  const profile = row.profile as StyleProfile | null;
  if (!profile) {
    return NextResponse.json({ error: "Report not ready" }, { status: 409 });
  }

  const current = normalizeLanguage(row.language);
  if (current === target) {
    return NextResponse.json({ ok: true, unchanged: true, balance: null });
  }

  const cost = CREDIT_COSTS.language_change;
  if (hasSupabaseAdmin) {
    const balance = await creditBalance(admin, user.id);
    if (balance < cost) {
      return NextResponse.json(
        {
          error: "Not enough credits.",
          code: "insufficient_credits",
          balance,
          needed: cost,
        },
        { status: 402 },
      );
    }
  }

  const { data: lookData } = await admin
    .from("looks")
    .select("id, context, title, description, palette")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });
  const lookRows = (lookData ?? []) as LookRow[];

  const colors = (row.colors as { best: ColorRec[]; avoid: ColorRec[] } | null) ?? {
    best: [],
    avoid: [],
  };
  const hair = (row.hair as { recommend: HairRec[]; avoid: HairRec[] } | null) ?? {
    recommend: [],
    avoid: [],
  };
  const silhouette =
    (row.silhouette as { fit: string; rules: string[] } | null) ?? {
      fit: "",
      rules: [],
    };
  const shopping = (row.shopping as ShoppingItem[] | null) ?? [];
  const lookItems =
    (row.look_items as Record<number, ShoppingItem[]> | null) ?? undefined;
  const doList = (row.do_list as string[] | null) ?? [];
  const dontList = (row.dont_list as string[] | null) ?? [];
  const facialHair = (row.facial_hair as FacialHairRec[] | null) ?? undefined;
  const eyewear = (row.eyewear as EyewearRec[] | null) ?? undefined;
  const accessories = (row.accessories as AccessoryRec[] | null) ?? undefined;
  const headwear = (row.headwear as HeadwearRec[] | null) ?? undefined;

  // Compute the deterministic "extras" from the current report so they can be
  // translated alongside the prose — only for non-English targets (English
  // reports compute extras live and store `extras: null`).
  const extras =
    target === "en"
      ? null
      : buildExtras(
          assembleReport({
            id: reportId,
            tier: row.tier as Tier,
            profile,
            content: {
              headline: row.headline ?? "",
              summary: row.summary ?? "",
              colors,
              hair,
              silhouette,
              looks: lookRows.map((l) => ({
                context: l.context ?? "",
                title: l.title ?? "",
                description: l.description ?? "",
                palette: l.palette ?? [],
              })),
              doList,
              dontList,
            },
            shopping: await enrichShoppingImages(shopping),
            lookItems,
          }),
        );

  let translated;
  try {
    translated = await translateReportParts(
      {
        headline: row.headline ?? "",
        summary: row.summary ?? "",
        colors,
        hair,
        silhouette,
        doList,
        dontList,
        looks: lookRows.map((l) => ({
          context: l.context ?? "",
          title: l.title ?? "",
          description: l.description ?? "",
          palette: l.palette ?? [],
        })),
        shopping,
        ...(lookItems ? { lookItems } : {}),
        ...(facialHair ? { facialHair } : {}),
        ...(eyewear ? { eyewear } : {}),
        ...(accessories ? { accessories } : {}),
        ...(headwear ? { headwear } : {}),
        ...(extras ? { extras } : {}),
      },
      target,
    );
  } catch (err) {
    console.error("[language] translation failed", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 502 });
  }

  const { error: updErr } = await admin
    .from("reports")
    .update({
      language: target,
      headline: translated.headline ?? row.headline,
      summary: translated.summary ?? row.summary,
      colors: translated.colors ?? colors,
      hair: translated.hair ?? hair,
      silhouette: translated.silhouette ?? silhouette,
      do_list: translated.doList ?? doList,
      dont_list: translated.dontList ?? dontList,
      shopping: translated.shopping ?? shopping,
      ...(translated.lookItems ? { look_items: translated.lookItems } : {}),
      ...(facialHair ? { facial_hair: translated.facialHair ?? facialHair } : {}),
      ...(eyewear ? { eyewear: translated.eyewear ?? eyewear } : {}),
      ...(accessories
        ? { accessories: translated.accessories ?? accessories }
        : {}),
      ...(headwear ? { headwear: translated.headwear ?? headwear } : {}),
      extras: target === "en" ? null : (translated.extras ?? null),
    })
    .eq("id", reportId);
  if (updErr) {
    return NextResponse.json(
      { error: "Could not save translation" },
      { status: 500 },
    );
  }

  const translatedLooks = translated.looks ?? [];
  await Promise.all(
    lookRows.map((l, i) => {
      const t = translatedLooks[i];
      if (!t) return Promise.resolve();
      return admin
        .from("looks")
        .update({
          context: t.context,
          title: t.title,
          description: t.description,
        })
        .eq("id", l.id);
    }),
  );

  let balance: number | null = null;
  if (hasSupabaseAdmin) {
    try {
      balance = await spendCredits(admin, {
        userId: user.id,
        amount: cost,
        reason: "language_change",
        refId: reportId,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            error: "Not enough credits.",
            code: "insufficient_credits",
            balance: e.balance,
            needed: e.needed,
          },
          { status: 402 },
        );
      }
      throw e;
    }
  }

  return NextResponse.json({ ok: true, balance, language: target });
}
