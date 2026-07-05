// Fix broken Marks & Spencer Cloudinary image URLs by re-fetching the live PDP.
//
//   node --env-file=.env.local scripts/fix-marks-spencer-images.mjs
//   node --env-file=.env.local scripts/fix-marks-spencer-images.mjs --source scraper:marks-spencer-fr
//   node --env-file=.env.local scripts/fix-marks-spencer-images.mjs --dry-run
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};
const sourceFilter = val("--source");

const sb = createClient(url, key, { auth: { persistSession: false } });
const TRANSFORM =
  "/upload/w_1200,h_1560,q_auto,f_auto,e_sharpen/";

async function imageOk(imageUrl) {
  if (!imageUrl) return false;
  const res = await fetch(imageUrl, { method: "HEAD" });
  return res.status === 200;
}

function normalizeImageUrl(raw) {
  let u = raw.replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
  if (!u.includes("/w_")) {
    u = u.replace("/upload/", TRANSFORM);
  }
  return u;
}

function variantCodeFromProduct(product) {
  const fromSku = product.sku?.split("-").pop()?.toUpperCase();
  const fromExt = product.external_id?.split("-").pop()?.toUpperCase();
  const fromLink = product.deeplink
    ?.match(/[?&]dwvar_[^=]+_color=([A-Z0-9]{2})/i)?.[1]
    ?.toUpperCase();
  return fromSku ?? fromExt ?? fromLink ?? null;
}

function withColorParam(deeplink, code) {
  return deeplink.replace(/(dwvar_[^=]+_color=)[A-Z0-9]{2}/i, `$1${code}`);
}

function parseSwatches(html) {
  const swatches = [];
  const re =
    /data-swatchid="([A-Z0-9]{2})"[\s\S]*?background-image:\s*url\(([^)]+)\)/gi;
  for (const m of html.matchAll(re)) {
    swatches.push({
      code: m[1].toUpperCase(),
      thumb: m[2].replace(/['"]/g, ""),
    });
  }
  return swatches;
}

/** Parse hero image from M&S PDP markup (carousel / JSON-LD). */
async function imageFromVariantPage(pageUrl, wantAssetCode) {
  const html = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ValettiCatalog/1.0)" },
  }).then((r) => r.text());

  const encoded = html.match(/data-product-images="(\[.*?\])"/)?.[1];
  if (encoded) {
    const images = JSON.parse(
      encoded.replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    );
    for (const item of images) {
      const candidate = normalizeImageUrl(item.url);
      const assetId = candidate.split("/").pop() ?? "";
      if (
        wantAssetCode &&
        !assetId.includes(`_${wantAssetCode}_`) &&
        !assetId.endsWith(`_${wantAssetCode}`)
      ) {
        continue;
      }
      if (await imageOk(candidate)) return candidate;
    }
  }

  for (const m of html.matchAll(
    /https:\/\/assets\.digitalcontent\.marksandspencer\.app\/image\/upload\/[^"'\s]+/g,
  )) {
    const candidate = normalizeImageUrl(m[0]);
    const assetId = candidate.split("/").pop() ?? "";
    if (!assetId.startsWith("SD_03_")) continue;
    if (wantAssetCode && !assetId.includes(`_${wantAssetCode}_`)) continue;
    if (await imageOk(candidate)) return candidate;
  }

  return null;
}

async function fetchPdpHtml(deeplink) {
  return fetch(deeplink, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ValettiCatalog/1.0)" },
  }).then((r) => r.text());
}

async function resolveReplacement(product) {
  const { image_url: brokenUrl, deeplink } = product;
  if (!deeplink || !brokenUrl) return null;

  const variantCode = variantCodeFromProduct(product);
  const assetId = brokenUrl.split("/").pop() ?? "";

  // 1) Same colour code, maybe CDN suffix changed (_0 → _90 etc.)
  if (assetId.includes("_X_EC_0")) {
    for (const suffix of ["_90", "_1", "_01"]) {
      const altId = assetId.replace(/_X_EC_0$/i, `_X_EC${suffix}`);
      const alt = brokenUrl.replace(assetId, altId);
      if (await imageOk(alt)) return alt;
    }
  }

  const html = await fetchPdpHtml(deeplink);
  const swatches = parseSwatches(html);
  const variantSwatch = swatches.find((s) => s.code === variantCode);
  const chipOnly = variantSwatch?.thumb.includes("/CS_");

  // 2) Full-image swatch thumb for this variant (SD_03… not CS_…)
  if (variantSwatch && !chipOnly && variantSwatch.thumb.includes("SD_03")) {
    const thumbId = variantSwatch.thumb.split("/").pop()?.replace(/_\d+$/, "_0");
    if (thumbId) {
      const alt = brokenUrl.replace(assetId, thumbId);
      if (await imageOk(alt)) return alt;
    }
  }

  // 3) Colour chip only (CS_XX) — M&S rotated asset id; try live swatches not yet in DB.
  if (chipOnly) {
    const strokePrefix = product.sku?.split("-")[0]?.toUpperCase();
    let codesInDb = new Set();
    if (strokePrefix) {
      const { data: siblings } = await sb
        .from("products")
        .select("sku")
        .eq("title", product.title)
        .like("sku", `${strokePrefix}-%`);
      codesInDb = new Set(
        (siblings ?? [])
          .map((s) => s.sku?.split("-").pop()?.toUpperCase())
          .filter(Boolean),
      );
    }

    for (const sw of swatches.filter((s) => s.thumb.includes("SD_03"))) {
      if (sw.code === variantCode || codesInDb.has(sw.code)) continue;
      const altId = assetId.replace(/_[A-Z0-9]{2}_X_EC_0/i, `_${sw.code}_X_EC_0`);
      for (const id of [altId, altId.replace(/_X_EC_0$/, "_X_EC_90")]) {
        const alt = brokenUrl.replace(assetId, id);
        if (await imageOk(alt)) return alt;
      }
    }
  }

  // 4) Fallback: current PDP carousel / JSON-LD hero.
  return imageFromVariantPage(deeplink, variantCode ?? undefined);
}

async function* iterProducts() {
  const size = 100;
  for (let from = 0; ; from += size) {
    let q = sb
      .from("products")
      .select(
        "id, title, image_url, deeplink, source, sku, external_id, color",
      )
      .like("source", "scraper:marks-spencer%")
      .not("image_url", "is", null)
      .order("id", { ascending: true })
      .range(from, from + size - 1);
    if (sourceFilter) q = q.eq("source", sourceFilter);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    yield* data;
    if (data.length < size) break;
  }
}

let checked = 0;
let broken = 0;
let fixed = 0;

for await (const product of iterProducts()) {
  checked++;
  if (await imageOk(product.image_url)) continue;
  broken++;

  const replacement = await resolveReplacement(product);
  if (!replacement) {
    console.log(
      `✗ no fix: ${product.title} (${product.color ?? "?"}) ${product.image_url.split("/").pop()}`,
    );
    continue;
  }

  console.log(
    `• ${product.title} (${product.color ?? "?"})\n  ${product.image_url.split("/").pop()} → ${replacement.split("/").pop()}`,
  );

  if (dryRun) {
    fixed++;
    continue;
  }

  const { error: prodErr } = await sb
    .from("products")
    .update({ image_url: replacement, updated_at: new Date().toISOString() })
    .eq("id", product.id);
  if (prodErr) throw prodErr;

  const { error: offErr } = await sb
    .from("product_offers")
    .update({ image_url: replacement, updated_at: new Date().toISOString() })
    .eq("product_id", product.id);
  if (offErr) throw offErr;

  fixed++;
}

console.log(
  `\nChecked ${checked}, broken ${broken}, ${dryRun ? "would fix" : "fixed"} ${fixed}`,
);
