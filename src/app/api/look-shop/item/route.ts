import { NextResponse } from "next/server";
import { hasSupabase, hasSupabaseAdmin } from "@/lib/env";
import {
  createServerSupabase,
  createAdminSupabase,
} from "@/lib/supabase/server";
import { styleProfileSchema, type StyleProfile } from "@/lib/style-profile";
import type { ShoppingItem } from "@/lib/report";
import { lookItemsFromCell } from "@/lib/style-extras";
import { findLookItemAlternatives } from "@/lib/data/catalog";
import { lookItemKey, swapLookItem } from "@/lib/look-item-alts";

export const maxDuration = 30;

type Body = {
  setId?: string;
  reportId?: string;
  lookIndex?: number;
  productId?: string;
  nextProductId?: string;
};

/**
 * Owner-only shop chip actions:
 *  - omit nextProductId → fill alternatives for that piece (heuristic, no Sonnet)
 *  - with nextProductId → swap the chip to that stored alternative
 */
export async function POST(request: Request) {
  if (!hasSupabase || !hasSupabaseAdmin) {
    return NextResponse.json({ error: "Live mode required" }, { status: 501 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const setId = typeof body.setId === "string" ? body.setId : "";
  const reportId = typeof body.reportId === "string" ? body.reportId : "";
  const lookIndex = body.lookIndex;
  const productId = typeof body.productId === "string" ? body.productId : "";
  const nextProductId =
    typeof body.nextProductId === "string" ? body.nextProductId : "";
  if ((!setId && !reportId) || typeof lookIndex !== "number" || !productId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const loaded = setId
    ? await loadSetShop(admin, user.id, setId, lookIndex)
    : await loadReportShop(admin, user.id, reportId, lookIndex);
  if (!loaded) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = loaded.items;
  const current = items.find((i) => lookItemKey(i) === productId);
  if (!current) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  let nextItems = items;
  if (nextProductId) {
    const alt = current.alternatives?.find(
      (a) => lookItemKey(a) === nextProductId,
    );
    if (!alt) {
      return NextResponse.json({ error: "Not an alternative" }, { status: 400 });
    }
    const swapped = swapLookItem(items, productId, alt);
    if (!swapped) {
      return NextResponse.json({ error: "Swap failed" }, { status: 400 });
    }
    nextItems = swapped;
  } else if (!current.alternatives?.length) {
    const alts = await findLookItemAlternatives(
      loaded.profile,
      loaded.look,
      current,
      { styleId: loaded.styleId, occasionId: loaded.occasionId },
    );
    nextItems = items.map((i) =>
      lookItemKey(i) === productId ? { ...i, alternatives: alts } : i,
    );
  }

  const lookItems = { ...loaded.lookItems, [lookIndex]: nextItems };
  if (setId) {
    const { error } = await admin
      .from("look_sets")
      .update({ look_items: lookItems })
      .eq("id", setId)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await admin
      .from("reports")
      .update({ look_items: lookItems })
      .eq("id", reportId)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, items: nextItems });
}

async function loadSetShop(
  admin: ReturnType<typeof createAdminSupabase>,
  userId: string,
  setId: string,
  lookIndex: number,
) {
  const { data: set } = await admin
    .from("look_sets")
    .select("look_items, style_id, occasion_id")
    .eq("id", setId)
    .eq("user_id", userId)
    .maybeSingle();
  const { data: prof } = await admin
    .from("look_set_profiles")
    .select("profile")
    .eq("set_id", setId)
    .eq("user_id", userId)
    .maybeSingle();
  const parsed = styleProfileSchema.safeParse(prof?.profile);
  if (!set || !parsed.success) return null;
  const { data: look } = await admin
    .from("looks")
    .select("title, description, context, palette, items")
    .eq("set_id", setId)
    .eq("idx", lookIndex)
    .maybeSingle();
  if (!look) return null;
  const lookItems =
    (set.look_items as Record<number, ShoppingItem[]> | null) ?? {};
  return {
    profile: parsed.data,
    lookItems,
    items: lookItems[lookIndex] ?? [],
    look: {
      title: look.title ?? "",
      description: look.description ?? "",
      context: look.context ?? "",
      palette: (look.palette as string[] | null) ?? [],
      items: lookItemsFromCell(look.items),
    },
    styleId: typeof set.style_id === "string" ? set.style_id : null,
    occasionId: typeof set.occasion_id === "string" ? set.occasion_id : null,
  };
}

async function loadReportShop(
  admin: ReturnType<typeof createAdminSupabase>,
  userId: string,
  reportId: string,
  lookIndex: number,
) {
  const { data: row } = await admin
    .from("reports")
    .select("look_items, profile")
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;
  const parsed = styleProfileSchema.safeParse(row.profile);
  if (!parsed.success) return null;
  const { data: looks } = await admin
    .from("looks")
    .select("idx, title, description, context, palette, items")
    .eq("report_id", reportId)
    .order("idx", { ascending: true });
  const look =
    looks?.find((l) => l.idx === lookIndex) ?? looks?.[lookIndex] ?? null;
  if (!look) return null;
  const lookItems =
    (row.look_items as Record<number, ShoppingItem[]> | null) ?? {};
  return {
    profile: parsed.data as StyleProfile,
    lookItems,
    items: lookItems[lookIndex] ?? [],
    look: {
      title: look.title ?? "",
      description: look.description ?? "",
      context: look.context ?? "",
      palette: (look.palette as string[] | null) ?? [],
      items: lookItemsFromCell(look.items),
    },
    styleId: null,
    occasionId: null,
  };
}
