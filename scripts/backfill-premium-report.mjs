#!/usr/bin/env node
/**
 * Backfill premium / lookbook image assets for a report that was tier-upgraded
 * after the original image job (capsule_images stays null).
 *
 *   node --env-file=.env.local scripts/backfill-premium-report.mjs <reportId>
 *   node --env-file=.env.local scripts/backfill-premium-report.mjs <reportId> --with-hair
 *   node --env-file=.env.local scripts/backfill-premium-report.mjs <reportId> --with-facial-hair
 *   node --env-file=.env.local scripts/backfill-premium-report.mjs <reportId> --with-eyewear
 *
 * Skips look regeneration when all looks already have image_path.
 */
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const modelImage =
  process.env.AI_MODEL_IMAGE ?? "google/gemini-3.1-flash-image-preview";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("Missing AI_GATEWAY_API_KEY");
  process.exit(1);
}

const reportId = process.argv[2];
const withHair = process.argv.includes("--with-hair");
const withFacialHair = process.argv.includes("--with-facial-hair");
const withEyewear = process.argv.includes("--with-eyewear");
if (!reportId) {
  console.error(
    "Usage: node --env-file=.env.local scripts/backfill-premium-report.mjs <reportId> [--with-hair] [--with-facial-hair] [--with-eyewear]",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

/** Same logic as src/lib/style-extras.ts capsuleMatrix */
function capsuleMatrix(shopping) {
  const pick = (cats) =>
    shopping.filter((i) => cats.includes(i.category)).map((i) => i.title);
  const layers = pick(["Outerwear"]);
  const tops = [...pick(["Knitwear", "Shirts"])];
  const bottoms = [...pick(["Trousers"]), "Dark indigo denim", "Taupe chinos"];
  const shoes = pick(["Footwear"]);
  const t = (layers[0] ? [layers[0], ...tops] : tops).slice(0, 3);
  const s = shoes.length ? shoes : ["Brown derbies"];

  const contexts = [
    "Boardroom",
    "Client lunch",
    "Smart casual",
    "Weekend",
    "Dinner",
    "Travel day",
  ];
  const combos = [];
  let ci = 0;
  for (let i = 0; i < t.length && combos.length < 6; i++) {
    for (let j = 0; j < bottoms.length && combos.length < 6; j++) {
      combos.push({
        context: contexts[ci % contexts.length],
        pieces: [t[i], bottoms[(i + j) % bottoms.length], s[(i + j) % s.length]],
      });
      ci++;
    }
  }
  return combos;
}

async function generateLookImage({ profile, look, referenceImageUrl }) {
  try {
    const subject =
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.bodyType} build. Soft natural light, neutral studio backdrop, ` +
      `confident relaxed pose, sharp focus, magazine quality. ` +
      `Vertical 9:16 framing, full body head to shoes visible. `;

    const imageRoles = referenceImageUrl
      ? `Preserve the face and identity of the person in the provided photo. `
      : `Do not show identifiable facial features. `;

    const prompt =
      `Editorial, full-length fashion photograph for a premium style report. ` +
      `Outfit: ${look.description}. ` +
      `Colour palette: ${look.palette.join(", ")}. ` +
      subject +
      imageRoles;

    const content = [{ type: "text", text: prompt }];
    if (referenceImageUrl) {
      content.push({ type: "image", image: new URL(referenceImageUrl) });
    }

    const result = await generateText({
      model: modelImage,
      messages: [{ role: "user", content }],
    });
    const file = result.files.find((f) => f.mediaType.startsWith("image/"));
    return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
  } catch (err) {
    console.error("[look image]", err?.message ?? err);
    return null;
  }
}

async function generateHairImage({ profile, hair, recommend, referenceImageUrl }) {
  try {
    const intent = recommend
      ? `Show this hairstyle as a flattering recommendation: ${hair.name}. ${hair.why}`
      : `Show this hairstyle as an example to avoid: ${hair.name}. ${hair.why}`;

    const prompt =
      `Editorial beauty headshot for a premium grooming report. ` +
      `Hairstyle: ${hair.name}. ${intent} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on hair and face, magazine quality, tasteful and respectful. ` +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only change the hairstyle.`
        : `Do not show identifiable facial features.`);

    const content = [{ type: "text", text: prompt }];
    if (referenceImageUrl) {
      content.push({ type: "image", image: new URL(referenceImageUrl) });
    }

    const result = await generateText({
      model: modelImage,
      messages: [{ role: "user", content }],
    });
    const file = result.files.find((f) => f.mediaType.startsWith("image/"));
    return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
  } catch (err) {
    console.error("[hair image]", err?.message ?? err);
    return null;
  }
}

const HAIR_GEN_LIMIT = 3;
const PREMIUM_GROOMING_GEN_LIMIT = 2;
const HAIR_GEN_DELAY_MS = 400;

function lc(s) {
  return (s ?? "").toLowerCase();
}

function eyewearFor(faceShape) {
  const f = lc(faceShape);
  if (f.includes("round")) {
    return {
      recommend: [
        { shape: "rectangle", name: "Rectangular", why: "Angular lines add definition and lengthen a round face." },
        { shape: "wayfarer", name: "Wayfarer", why: "Structured top bar sharpens soft features." },
      ],
    };
  }
  if (f.includes("square")) {
    return {
      recommend: [
        { shape: "round", name: "Round", why: "Soft curves balance a strong, angular jaw." },
        { shape: "aviator", name: "Aviator", why: "Curved bottom edge softens square corners." },
      ],
    };
  }
  return {
    recommend: [
      { shape: "wayfarer", name: "Wayfarer", why: "Classic balance for an oval face — versatile and modern." },
      { shape: "rectangle", name: "Rectangular", why: "Keeps proportions in check without elongating." },
    ],
  };
}

function facialHairFor(profile) {
  const gender = lc(profile.demographics.genderPresentation);
  if (gender === "female") {
    return [
      { name: "Clean-shaven", why: "Keeps focus on your features and pairs cleanly with structured tailoring." },
      { name: "Soft natural brows", why: "Well-groomed brows frame the face — the detail that reads as polished." },
    ];
  }
  const f = lc(profile.physical.faceShape);
  if (f.includes("round")) {
    return [
      { name: "Short boxed beard", why: "A slightly longer chin with tighter cheeks adds length to a round face." },
      { name: "Light stubble", why: "Even 2–3 mm stubble sharpens the jaw without adding width." },
    ];
  }
  return [
    { name: "Short even beard", why: "A tidy, even line suits an oval face — natural cheek line, clean neckline." },
    { name: "Refined stubble", why: "Low-maintenance texture that reads modern without overpowering your features." },
  ];
}

async function generateFacialHairImage({ profile, style, referenceImageUrl }) {
  try {
    const prompt =
      `Editorial grooming headshot for a premium style report. ` +
      `Facial hair style: ${style.name}. ${style.why} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on face and facial hair, magazine quality, tasteful and respectful. ` +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only change the facial hair style.`
        : `Do not show identifiable facial features.`);

    const content = [{ type: "text", text: prompt }];
    if (referenceImageUrl) {
      content.push({ type: "image", image: new URL(referenceImageUrl) });
    }

    const result = await generateText({
      model: modelImage,
      messages: [{ role: "user", content }],
    });
    const file = result.files.find((f) => f.mediaType.startsWith("image/"));
    return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
  } catch (err) {
    console.error("[facial hair image]", err?.message ?? err);
    return null;
  }
}

async function generateEyewearImage({ profile, frame, referenceImageUrl }) {
  try {
    const prompt =
      `Editorial eyewear headshot for a premium style report. ` +
      `Glasses frames: ${frame.name}${frame.shape ? ` (${frame.shape} shape)` : ""}. ${frame.why} ` +
      `Subject: ${profile.demographics.genderPresentation}, around age ${profile.demographics.age}, ` +
      `${profile.physical.faceShape} face shape. Shoulders-up framing, neutral soft studio backdrop, ` +
      `natural soft light, sharp focus on face and glasses, magazine quality, tasteful and respectful. ` +
      (referenceImageUrl
        ? `Preserve the face, skin tone, and identity of the person in the provided photo — only add or change the eyewear.`
        : `Do not show identifiable facial features.`);

    const content = [{ type: "text", text: prompt }];
    if (referenceImageUrl) {
      content.push({ type: "image", image: new URL(referenceImageUrl) });
    }

    const result = await generateText({
      model: modelImage,
      messages: [{ role: "user", content }],
    });
    const file = result.files.find((f) => f.mediaType.startsWith("image/"));
    return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
  } catch (err) {
    console.error("[eyewear image]", err?.message ?? err);
    return null;
  }
}

async function signUserPhotos(userId) {
  const { data: photoRows } = await admin
    .from("photos")
    .select("role, storage_path")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const photos = [];
  for (const p of photoRows ?? []) {
    const { data } = await admin.storage
      .from("photos")
      .createSignedUrl(p.storage_path, 600);
    if (data?.signedUrl) photos.push({ role: p.role, url: data.signedUrl });
  }
  return photos;
}

async function main() {
  const { data: row, error } = await admin
    .from("reports")
    .select(
      "id, user_id, tier, status, profile, shopping, capsule_images, hair, facial_hair, eyewear",
    )
    .eq("id", reportId)
    .single();

  if (error || !row) {
    console.error("Report not found:", error?.message);
    process.exit(1);
  }

  const tier = row.tier;
  if (tier !== "lookbook" && tier !== "premium") {
    console.error(`Report tier is "${tier}" — capsule backfill applies to lookbook/premium only.`);
    process.exit(1);
  }

  const userId = row.user_id;
  const profile = row.profile;
  const shopping = row.shopping ?? [];
  const photos = await signUserPhotos(userId);
  const referenceImageUrl =
    photos.find((p) => p.role === "full")?.url ?? photos[0]?.url;

  console.log(`Report ${reportId} tier=${tier} status=${row.status}`);
  console.log(`Reference photo: ${referenceImageUrl ? "yes" : "no"}`);
  console.log(`Existing capsule_images: ${JSON.stringify(row.capsule_images)}`);

  const { data: looks } = await admin
    .from("looks")
    .select("id, title, image_path")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  const looksComplete =
    (looks?.length ?? 0) > 0 && looks.every((l) => Boolean(l.image_path));
  console.log(`Looks: ${looks?.length ?? 0} (${looksComplete ? "images OK" : "some missing"})`);

  if (withHair && referenceImageUrl) {
    console.log("Generating hairstyle preview images…");
    const hair = {
      recommend: (row.hair?.recommend ?? []).map((h) => ({ ...h })),
      avoid: (row.hair?.avoid ?? []).map((h) => ({ ...h })),
    };
    const slots = [];
    for (let i = 0; i < Math.min(HAIR_GEN_LIMIT, hair.recommend.length); i++) {
      slots.push({ list: "recommend", index: i });
    }
    for (let i = 0; i < Math.min(HAIR_GEN_LIMIT, hair.avoid.length); i++) {
      slots.push({ list: "avoid", index: i });
    }
    for (const { list, index } of slots) {
      const item = hair[list][index];
      const img = await generateHairImage({
        profile,
        hair: item,
        recommend: list === "recommend",
        referenceImageUrl,
      });
      if (img) {
        const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
        const path = `${userId}/${reportId}/hair-${list}-${index}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("assets")
          .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
        if (!upErr) {
          hair[list][index] = { ...item, imagePath: path };
          await admin.from("reports").update({ hair }).eq("id", reportId);
          console.log(`  ✓ hair ${list}[${index}] → ${path}`);
        } else {
          console.error(`  ✗ upload ${path}:`, upErr.message);
        }
      } else {
        console.warn(`  ✗ hair ${list}[${index}] generation failed`);
      }
      await new Promise((r) => setTimeout(r, HAIR_GEN_DELAY_MS));
    }
  }

  if (tier === "premium" && withFacialHair && referenceImageUrl) {
    console.log("Generating facial hair preview images…");
    let facialHair = (row.facial_hair ?? []).map((h) => ({ ...h }));
    if (!facialHair.length) {
      facialHair = facialHairFor(profile).slice(0, PREMIUM_GROOMING_GEN_LIMIT);
      await admin.from("reports").update({ facial_hair: facialHair }).eq("id", reportId);
    }
    for (let i = 0; i < facialHair.length; i++) {
      const item = facialHair[i];
      if (item.imagePath) {
        console.log(`  skip facial_hair[${i}] — already has path`);
        continue;
      }
      const img = await generateFacialHairImage({
        profile,
        style: item,
        referenceImageUrl,
      });
      if (img) {
        const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
        const path = `${userId}/${reportId}/facial-hair-${i}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("assets")
          .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
        if (!upErr) {
          facialHair[i] = { ...item, imagePath: path };
          await admin.from("reports").update({ facial_hair: facialHair }).eq("id", reportId);
          console.log(`  ✓ facial_hair[${i}] → ${path}`);
        } else {
          console.error(`  ✗ upload ${path}:`, upErr.message);
        }
      } else {
        console.warn(`  ✗ facial_hair[${i}] generation failed`);
      }
      await new Promise((r) => setTimeout(r, HAIR_GEN_DELAY_MS));
    }
  }

  if (tier === "premium" && withEyewear && referenceImageUrl) {
    console.log("Generating eyewear preview images…");
    let eyewear = (row.eyewear ?? []).map((h) => ({ ...h }));
    if (!eyewear.length) {
      eyewear = eyewearFor(profile.physical.faceShape).recommend
        .slice(0, PREMIUM_GROOMING_GEN_LIMIT)
        .map((f) => ({ name: f.name, why: f.why, shape: f.shape }));
      await admin.from("reports").update({ eyewear }).eq("id", reportId);
    }
    for (let i = 0; i < eyewear.length; i++) {
      const item = eyewear[i];
      if (item.imagePath) {
        console.log(`  skip eyewear[${i}] — already has path`);
        continue;
      }
      const img = await generateEyewearImage({
        profile,
        frame: item,
        referenceImageUrl,
      });
      if (img) {
        const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
        const path = `${userId}/${reportId}/eyewear-${i}.${ext}`;
        const { error: upErr } = await admin.storage
          .from("assets")
          .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
        if (!upErr) {
          eyewear[i] = { ...item, imagePath: path };
          await admin.from("reports").update({ eyewear }).eq("id", reportId);
          console.log(`  ✓ eyewear[${i}] → ${path}`);
        } else {
          console.error(`  ✗ upload ${path}:`, upErr.message);
        }
      } else {
        console.warn(`  ✗ eyewear[${i}] generation failed`);
      }
      await new Promise((r) => setTimeout(r, HAIR_GEN_DELAY_MS));
    }
  }

  const existingCapsule = (row.capsule_images ?? []).filter(Boolean);
  if (existingCapsule.length > 0) {
    console.log(`Capsule already has ${existingCapsule.length} paths — skipping capsule gen.`);
  } else {
    console.log("Generating capsule wardrobe images…");
    const colorByTitle = new Map(shopping.map((s) => [s.title, s.color]));
    const matrix = capsuleMatrix(shopping);
    console.log(`  ${matrix.length} outfit combinations`);

    const capsulePaths = [];
    for (let i = 0; i < matrix.length; i++) {
      const combo = matrix[i];
      console.log(`  [${i + 1}/${matrix.length}] ${combo.context}: ${combo.pieces.join(", ")}`);
      const img = await generateLookImage({
        profile,
        look: {
          title: combo.context,
          description: combo.pieces.join(", "),
          palette: combo.pieces
            .map((p) => colorByTitle.get(p))
            .filter(Boolean),
        },
        referenceImageUrl,
      });
      if (!img) {
        capsulePaths.push(null);
        console.warn(`    ✗ no image returned`);
        continue;
      }
      const ext = img.mediaType.includes("jpeg") ? "jpg" : "png";
      const path = `${userId}/${reportId}/capsule-${i}.${ext}`;
      const { error: upErr } = await admin.storage
        .from("assets")
        .upload(path, img.bytes, { contentType: img.mediaType, upsert: true });
      if (upErr) {
        capsulePaths.push(null);
        console.error(`    ✗ upload:`, upErr.message);
      } else {
        capsulePaths.push(path);
        console.log(`    ✓ ${path}`);
      }
    }

    const { error: updErr } = await admin
      .from("reports")
      .update({ capsule_images: capsulePaths })
      .eq("id", reportId);
    if (updErr) {
      console.error("Failed to update capsule_images:", updErr.message);
      process.exit(1);
    }
    console.log("Updated reports.capsule_images:", capsulePaths);
  }

  const { data: verify } = await admin
    .from("reports")
    .select("capsule_images, hair, facial_hair, eyewear")
    .eq("id", reportId)
    .single();
  console.log("\nVerify DB:");
  console.log("  capsule_images:", verify?.capsule_images);
  if (withHair) {
    console.log(
      "  hair imagePaths recommend:",
      verify?.hair?.recommend?.map((h) => h.imagePath ?? null),
    );
  }
  if (withFacialHair) {
    console.log(
      "  facial_hair imagePaths:",
      verify?.facial_hair?.map((h) => h.imagePath ?? null),
    );
  }
  if (withEyewear) {
    console.log(
      "  eyewear imagePaths:",
      verify?.eyewear?.map((h) => h.imagePath ?? null),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
