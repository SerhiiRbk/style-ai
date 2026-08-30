/**
 * Re-render looks in a Create-a-Look set with current wearable rules
 * (strip handheld props from briefs, new image paths to bust cache).
 * Does not charge credits.
 *
 *   node --env-file=.env.local --import ./scripts/register-server-only.mjs --import tsx \
 *     scripts/regen-look-set.ts <setId> [--indexes=0,1] [--rebrief] [--items-only]
 *
 * --rebrief  rewrite titles/descriptions from generateExtraLook (occasion ×
 *            strictness), then render. Default only re-renders stored briefs.
 * --items-only  rematch Shop the Look only — no new images or briefs.
 */
import { createClient } from "@supabase/supabase-js";
import { generateExtraLook, generateLookImage } from "../src/lib/ai/pipeline";
import {
  partyJacketFabricDirective,
  partyJacketMatchesSlot,
  sanitizeLookDescription,
} from "../src/lib/ai/look-brief";
import { lookContextById } from "../src/lib/look-contexts";
import { buildLookIntake } from "../src/lib/look-sets";
import {
  bestSwatchesForProfile,
  lookSetColorRecipes,
} from "../src/lib/look-set-color-recipes";
import { matchLookItems } from "../src/lib/data/catalog";
import { archiveReplacedLookImages } from "../src/lib/data/look-sets";
import {
  Boldness,
  styleProfileSchema,
  type ReportContent,
  type StyleProfile,
} from "../src/lib/style-profile";
import type { LookBriefSeason } from "../src/lib/ai/look-brief";
import type { ShoppingItem } from "../src/lib/report";

const SET_ID = process.argv[2];
const REBRIEF = process.argv.includes("--rebrief");
const ITEMS_ONLY = process.argv.includes("--items-only");
const indexesArg = process.argv.find((a) => a.startsWith("--indexes="));
const onlyIndexes = indexesArg
  ? indexesArg
      .slice("--indexes=".length)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0)
  : null;

if (!SET_ID) {
  console.error("Usage: scripts/regen-look-set.ts <setId> [--indexes=0,1] [--rebrief]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  console.error("Missing AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signPhoto(path: string | null | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const { data, error } = await admin.storage
    .from("photos")
    .createSignedUrl(path, 600);
  if (error || !data?.signedUrl) {
    console.warn("could not sign photo", path, error?.message);
    return undefined;
  }
  return data.signedUrl;
}

async function main() {
  let setQuery = await admin
    .from("look_sets")
    .select("id, user_id, name, look_items, occasion_id, season, boldness, style_id")
    .eq("id", SET_ID)
    .maybeSingle();
  if (setQuery.error && /style_id/.test(setQuery.error.message)) {
    setQuery = await admin
      .from("look_sets")
      .select("id, user_id, name, look_items, occasion_id, season, boldness")
      .eq("id", SET_ID)
      .maybeSingle();
  }
  const { data: set, error: setErr } = setQuery;
  if (setErr || !set) {
    throw new Error(setErr?.message ?? `Look set ${SET_ID} not found`);
  }
  const setStyleId =
    typeof (set as { style_id?: string | null }).style_id === "string"
      ? (set as { style_id: string }).style_id
      : undefined;
  const userId = set.user_id as string;

  const { data: profRow, error: profErr } = await admin
    .from("look_set_profiles")
    .select("profile, face_ref_path, full_ref_path")
    .eq("set_id", SET_ID)
    .eq("user_id", userId)
    .maybeSingle();
  if (profErr) throw new Error(profErr.message);
  const rawProfile = profRow?.profile as Record<string, unknown> | undefined;
  if (rawProfile && typeof rawProfile.demographics === "object" && rawProfile.demographics) {
    rawProfile.demographics = {
      city: "",
      country: "",
      climate: "",
      ...(rawProfile.demographics as Record<string, unknown>),
    };
  }
  const parsed = styleProfileSchema.safeParse(rawProfile);
  if (!parsed.success) {
    throw new Error("Look set has no valid style profile");
  }
  const setBoldness = Boldness.safeParse(set.boldness).success
    ? Boldness.parse(set.boldness)
    : parsed.data.boldness;
  const profile: StyleProfile = { ...parsed.data, boldness: setBoldness };

  const looksQuery = await admin
    .from("looks")
    .select("id, idx, context, title, description, palette, items, image_path, image_path_tq")
    .eq("set_id", SET_ID)
    .order("idx", { ascending: true });
  const looks =
    looksQuery.error && /image_path_tq/.test(looksQuery.error.message)
      ? await admin
          .from("looks")
          .select("id, idx, context, title, description, palette, items, image_path")
          .eq("set_id", SET_ID)
          .order("idx", { ascending: true })
      : looksQuery;
  if (looks.error) throw new Error(looks.error.message);
  const rows = looks.data ?? [];
  if (!rows.length) throw new Error("Set has no looks");

  const faceUrl = await signPhoto(profRow?.face_ref_path as string | null);
  const fullUrl = await signPhoto(profRow?.full_ref_path as string | null);

  const ctx = lookContextById(set.occasion_id as string | null);
  const season = (set.season as LookBriefSeason | null) ?? undefined;
  const intake = {
    ...buildLookIntake({
      age: profile.demographics.age,
      bodyType: profile.physical.bodyType,
    }),
    boldness: setBoldness,
    goals: profile.goals,
    lifestyle: profile.lifestyle,
  };
  const colorRecipes = lookSetColorRecipes(
    bestSwatchesForProfile(profile),
    rows.length,
    { boldness: setBoldness, occasionId: ctx?.id },
  );

  if (REBRIEF && profile.boldness !== parsed.data.boldness) {
    await admin
      .from("look_set_profiles")
      .update({ profile })
      .eq("set_id", SET_ID)
      .eq("user_id", userId);
  }

  console.log(
    `Set ${SET_ID} · ${set.name} · ${rows.length} looks · ${set.occasion_id}/${setBoldness}` +
      `${REBRIEF ? " · rebrief" : ""} · face=${Boolean(faceUrl)} full=${Boolean(fullUrl)}`,
  );

  const lookItems =
    (set.look_items as Record<number, ShoppingItem[]> | null) ?? {};
  let regenerated = 0;
  const titlesSoFar: string[] = [];

  for (const row of rows) {
    const idx = row.idx as number;
    if (ITEMS_ONLY) {
      if (row.title) titlesSoFar.push(String(row.title));
      continue;
    }

    if (onlyIndexes && !onlyIndexes.includes(idx)) {
      const cleanedSkip = sanitizeLookDescription(String(row.description ?? ""));
      if (cleanedSkip !== (row.description ?? "")) {
        await admin.from("looks").update({ description: cleanedSkip }).eq("id", row.id);
        console.log(`  look ${idx}: stripped description only`);
      } else {
        console.log(`  look ${idx}: skipped`);
      }
      if (row.title) titlesSoFar.push(String(row.title));
      continue;
    }

    let title = (row.title as string) ?? "Look";
    let description = sanitizeLookDescription(String(row.description ?? ""));
    let palette = (row.palette as string[]) ?? [];
    let context = (row.context as string) ?? ctx?.context ?? "";

    if (REBRIEF) {
      if (!ctx) throw new Error(`Unknown occasion ${set.occasion_id}`);
      const needsJacket = ctx.id === "party" && setBoldness === "statement";
      const jacketNote =
        ctx.id === "party"
          ? `${partyJacketFabricDirective(idx)} This look MUST open with that jacket. Do not write a shirt-only outfit.`
          : "This look MUST open with a blazer or sport coat. Do not write a shirt-only outfit.";
      let next = await generateExtraLook({
        intake,
        profile,
        context: ctx.context,
        brief: ctx.brief,
        boldness: setBoldness,
        season,
        occasionId: ctx.id,
        lookIndex: idx,
        looksCount: rows.length,
        styleId: setStyleId,
        existingTitles: titlesSoFar,
        colorRecipe: colorRecipes[idx],
        ...(needsJacket ? { note: jacketNote } : {}),
      });
      for (
        let attempt = 0;
        attempt < 2 &&
        needsJacket &&
        !partyJacketMatchesSlot(next.description, idx);
        attempt++
      ) {
        next = await generateExtraLook({
          intake,
          profile,
          context: ctx.context,
          brief: ctx.brief,
          boldness: setBoldness,
          season,
          occasionId: ctx.id,
          lookIndex: idx,
          looksCount: rows.length,
          styleId: setStyleId,
          existingTitles: titlesSoFar,
          colorRecipe: colorRecipes[idx],
          note: jacketNote,
        });
      }
      title = next.title;
      description = sanitizeLookDescription(next.description);
      palette = next.palette;
      context = next.context;
    }

    const look = { title, description, palette };

    console.log(`  look ${idx}: ${title}`);
    console.log(`    brief: ${description}`);

    const img = await generateLookImage({
      profile,
      look,
      referenceImageUrl: fullUrl,
      faceReferenceImageUrl: faceUrl,
      occasionId: ctx?.id,
    });
    if (!img) {
      console.error(`    generateLookImage returned null`);
      continue;
    }

    const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
    const stamp = Date.now().toString(36);
    const imagePath = `${userId}/looksets/${SET_ID}/${idx}-r${stamp}.${ext}`;
    const { error: upErr } = await admin.storage.from("assets").upload(imagePath, img.bytes, {
      contentType: img.mediaType,
      upsert: true,
    });
    if (upErr) {
      console.error(`    upload failed: ${upErr.message}`);
      continue;
    }

    await archiveReplacedLookImages(admin, SET_ID, [
      { path: row.image_path as string | null, title },
      {
        path: (row as { image_path_tq?: string | null }).image_path_tq ?? null,
        title: `${title} · 3/4`,
      },
    ]);

    const update: Record<string, unknown> = {
      title,
      context,
      description,
      palette,
      image_path: imagePath,
      image_path_tq: null,
    };
    let { error: updErr } = await admin.from("looks").update(update).eq("id", row.id);
    if (updErr && /image_path_tq/.test(updErr.message)) {
      delete update.image_path_tq;
      ({ error: updErr } = await admin.from("looks").update(update).eq("id", row.id));
    }
    if (updErr) {
      console.error(`    look row update failed: ${updErr.message}`);
      continue;
    }

    try {
      const content = {
        colors: { best: [], avoid: [] },
        looks: [
          {
            context: (row.context as string) ?? "",
            title,
            description,
            palette,
          },
        ],
      } as unknown as ReportContent;
      const matched = await matchLookItems(profile, content, {
        styleId: setStyleId,
      });
      if (matched[0]?.length) {
        lookItems[idx] = matched[0];
      }
    } catch (err) {
      console.error(`    rematch failed`, err);
    }

    titlesSoFar.push(title);
    regenerated += 1;
    console.log(`    stored ${imagePath}`);
  }

  if (ITEMS_ONLY) {
    const rematchRows = onlyIndexes
      ? rows.filter((row) => onlyIndexes.includes(row.idx as number))
      : rows;
    const content = {
      colors: { best: [], avoid: [] },
      looks: rematchRows.map((row) => ({
        context: (row.context as string) ?? "",
        title: (row.title as string) ?? "Look",
        description: sanitizeLookDescription(String(row.description ?? "")),
        palette: (row.palette as string[]) ?? [],
        items: Array.isArray((row as { items?: unknown }).items)
          ? (row as { items: unknown }).items
          : undefined,
      })),
    } as unknown as ReportContent;
    const byPos = await matchLookItems(profile, content, {
      styleId: setStyleId,
    });
    rematchRows.forEach((row, p) => {
      const matched = byPos[p];
      if (matched?.length) lookItems[row.idx as number] = matched;
    });
    regenerated = rematchRows.length;
    console.log(`  rematched ${regenerated} looks`);
  }

  const { error: liErr } = await admin
    .from("look_sets")
    .update({ look_items: lookItems })
    .eq("id", SET_ID);
  if (liErr) console.error("look_items persist failed", liErr.message);

  console.log(
    ITEMS_ONLY
      ? `Done. Rematched shop items for ${regenerated}/${rows.length} looks.`
      : `Done. Regenerated ${regenerated}/${rows.length} looks.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
