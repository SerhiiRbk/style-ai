/**
 * Re-render one Create-a-Look try-on (no credit charge).
 *   NODE_PATH=scripts/shims node --env-file=.env.local \
 *     --import ./scripts/register-server-only.mjs --import tsx \
 *     scripts/regen-look-tryon.ts <setId> <lookIndex>
 */
import { createClient } from "@supabase/supabase-js";
import { generateLookImage } from "../src/lib/ai/pipeline";
import { styleProfileSchema } from "../src/lib/style-profile";
import {
  catalogImageRefsFromItems,
  catalogPromptFromItems,
  MAX_CATALOG_REFERENCE_IMAGES_WITH_PORTRAIT,
  formatLookKey,
  tryonStoragePath,
} from "../src/lib/look-tryon";
import { resolveLookSetReferencePhotos } from "../src/lib/photo-tryon";
import type { ShoppingItem } from "../src/lib/report";

const SET_ID = process.argv[2];
const LOOK_INDEX = Number(process.argv[3]);

if (!SET_ID || !Number.isInteger(LOOK_INDEX)) {
  console.error("Usage: regen-look-tryon.ts <setId> <lookIndex>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: set, error: setErr } = await admin
    .from("look_sets")
    .select("id, user_id, look_items, report_id, created_at, occasion_id")
    .eq("id", SET_ID)
    .maybeSingle();
  if (setErr || !set) throw new Error(setErr?.message ?? "set not found");

  const userId = set.user_id as string;
  const { data: profRow, error: profErr } = await admin
    .from("look_set_profiles")
    .select("profile, face_ref_path, full_ref_path")
    .eq("set_id", SET_ID)
    .eq("user_id", userId)
    .maybeSingle();
  if (profErr) throw new Error(profErr.message);
  const raw = profRow?.profile as Record<string, unknown> | undefined;
  if (raw && typeof raw.demographics === "object" && raw.demographics) {
    raw.demographics = {
      city: "",
      country: "",
      climate: "",
      ...(raw.demographics as Record<string, unknown>),
    };
  }
  const parsed = styleProfileSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid profile");

  const { data: look, error: lookErr } = await admin
    .from("looks")
    .select("idx, title, description, palette")
    .eq("set_id", SET_ID)
    .eq("idx", LOOK_INDEX)
    .maybeSingle();
  if (lookErr || !look) throw new Error(lookErr?.message ?? "look not found");

  const lookItems =
    (set.look_items as Record<number, ShoppingItem[]> | null) ?? {};
  const items = lookItems[LOOK_INDEX] ?? [];
  const occasionId =
    typeof (set as { occasion_id?: string | null }).occasion_id === "string"
      ? (set as { occasion_id: string }).occasion_id
      : null;
  const catalogContext = catalogPromptFromItems(
    items,
    String(look.description ?? ""),
    occasionId,
  );
  const catalogImages = catalogImageRefsFromItems(items, {
    max: MAX_CATALOG_REFERENCE_IMAGES_WITH_PORTRAIT,
  });
  console.log(
    `look ${LOOK_INDEX} · ${look.title} · ${items.length} items · refs ${catalogImages.length}`,
  );
  for (const it of items) {
    console.log(`  ${it.category}: ${it.colorName ?? it.color} ${it.title}`);
  }
  console.log("prompt colour lines:");
  console.log(catalogContext);

  const refs = await resolveLookSetReferencePhotos(admin, {
    userId,
    setId: SET_ID,
    facePath: (profRow?.face_ref_path as string | null) ?? null,
    fullPath: (profRow?.full_ref_path as string | null) ?? null,
    reportId: (set.report_id as string | null) ?? null,
    reportCreatedAt: set.created_at as string,
  });
  if (!refs.fullUrl) throw new Error("no full-length reference photo");

  const result = await generateLookImage({
    profile: parsed.data,
    occasionId,
    look: {
      title: String(look.title ?? "Look"),
      description: String(look.description ?? ""),
      palette: (look.palette as string[]) ?? [],
      catalogContext,
      catalogImageUrls: catalogImages.map((r) => r.url),
      catalogImages,
    },
    referenceImageUrl: refs.fullUrl,
    faceReferenceImageUrl: refs.faceUrl ?? undefined,
    profileReferenceImageUrl: refs.profileUrl ?? undefined,
    promptVersion: 4,
  });
  if (!result) throw new Error("generateLookImage returned null");

  const ext = result.mediaType.includes("jpeg") ? "jpg" : "png";
  const lookKey = formatLookKey({ kind: "look", lookIndex: LOOK_INDEX });
  const path = tryonStoragePath(userId, SET_ID, lookKey, ext);
  const { error: upErr } = await admin.storage.from("assets").upload(path, result.bytes, {
    contentType: result.mediaType,
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);

  const garments = items.map((it) => ({
    productId: it.productId ?? null,
    title: it.title,
    category: it.category,
    imageUrl: it.image ?? null,
  }));
  const { data: inserted, error: insErr } = await admin
    .from("tryons")
    .insert({
      user_id: userId,
      report_id: null,
      image_path: path,
      status: "ready",
      kind: "look",
      garments,
    })
    .select("created_at")
    .single();
  if (insErr) console.error("tryons insert", insErr.message);
  console.log("stored", path, inserted?.created_at);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
