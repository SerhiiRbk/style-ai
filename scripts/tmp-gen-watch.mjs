#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const modelImage =
  process.env.AI_MODEL_IMAGE ?? "google/gemini-3.1-flash-image-preview";
const reportId = process.argv[2];
if (!url || !serviceKey || !process.env.AI_GATEWAY_API_KEY || !reportId) {
  console.error("Need env + reportId", {
    url: !!url,
    key: !!serviceKey,
    ai: !!process.env.AI_GATEWAY_API_KEY,
    reportId: !!reportId,
  });
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return { h: 0, s: 0, l: 0.6 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return { h: 0, s: 0, l };
}

function pickByLightness(palette, target, def) {
  let best = null;
  let bestGap = Infinity;
  for (const c of palette) {
    if (!/^#?[0-9a-f]{6}$/i.test((c.hex || "").trim())) continue;
    const gap = Math.abs(hexToHsl(c.hex).l - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = { name: c.name, hex: c.hex };
    }
  }
  return best ?? def;
}

function metalsFor(undertone) {
  const u = (undertone || "").toLowerCase();
  if (u === "cool")
    return [
      { name: "Silver", hex: "#C7CCD1" },
      { name: "Brushed steel", hex: "#9AA4AD" },
    ];
  if (u === "warm")
    return [
      { name: "Yellow gold", hex: "#C9A24B" },
      { name: "Brass / bronze", hex: "#9A7B4F" },
    ];
  return [
    { name: "Soft gold", hex: "#C2A35C" },
    { name: "Steel", hex: "#A2AAB2" },
  ];
}

function watchVariants(profile, best) {
  const undertone = (profile?.physical?.undertone || "").toLowerCase();
  const metals = metalsFor(undertone);
  const primary = metals[0];
  const secondary = metals[1] ?? primary;
  const warm = undertone === "warm";
  const lightDial = pickByLightness(best, 0.82, {
    name: warm ? "Warm cream" : "Silver white",
    hex: warm ? "#EFE7D6" : "#E7E9EC",
  });
  const midDial = pickByLightness(best, 0.5, {
    name: warm ? "Olive" : "Slate blue",
    hex: warm ? "#6E6A4A" : "#4E6076",
  });
  const darkDial = pickByLightness(best, 0.3, {
    name: warm ? "Espresso" : "Soft charcoal",
    hex: warm ? "#3B322A" : "#3A3F47",
  });
  const dressLeather = warm
    ? { name: "Dark brown leather", hex: "#4A3526" }
    : { name: "Black leather", hex: "#1C1C1E" };
  const bracelet = { name: `${primary.name} bracelet`, hex: primary.hex };
  const casualStrap = warm
    ? { name: "Tan suede / fabric", hex: "#9A7B54" }
    : { name: "Grey suede / fabric", hex: "#7C818A" };
  return [
    {
      context: "Boardroom",
      caseMetal: primary.name,
      dial: lightDial.name,
      strap: dressLeather.name,
    },
    {
      context: "Everyday",
      caseMetal: primary.name,
      dial: darkDial.name,
      strap: bracelet.name,
    },
    {
      context: "Weekend",
      caseMetal: secondary.name,
      dial: midDial.name,
      strap: casualStrap.name,
    },
  ];
}

const { data: row, error } = await admin
  .from("reports")
  .select("id, user_id, tier, profile, colors, watch_image")
  .eq("id", reportId)
  .single();
if (error || !row) {
  console.error("load", error?.message);
  process.exit(1);
}
console.log({ tier: row.tier, watch_image: row.watch_image });
if (row.watch_image) {
  console.log("already set");
  process.exit(0);
}
if (row.tier !== "lookbook" && row.tier !== "premium") {
  console.error("tier not eligible");
  process.exit(1);
}

const best = row.colors?.best ?? [];
const variants = watchVariants(row.profile, best);
console.log("variants", variants.map((v) => `${v.context}: ${v.caseMetal}/${v.dial}/${v.strap}`));
const palette = best.map((c) => c.name).filter(Boolean);
const lines = variants.map(
  (v, i) =>
    `${i + 1}. ${v.context}: ${v.caseMetal} case, ${v.dial} dial, ${v.strap} strap.`,
);
const prompt =
  `A clean, top-down editorial flat-lay product photograph of ${variants.length} ` +
  `men's wristwatches arranged in a neat row on a soft warm-neutral surface ` +
  `(smooth plaster / fine linen), gentle daylight, soft shadows, high-end catalogue ` +
  `quality, sharp focus. Each watch is a different configuration:\n${lines.join("\n")}\n` +
  `Render generic, unbranded watches — NO brand names, NO logos, NO numerals or text ` +
  `of any kind on the dials, cases, straps or background. Classic minimalist dress-watch ` +
  `design with slim cases and clean dials. ` +
  (palette.length ? `Overall colour harmony: ${palette.join(", ")}. ` : "") +
  `The watches must clearly differ in case metal, dial colour and strap as described. ` +
  `Absolutely no text, watermarks, captions, logos or brand names in the image.`;

console.log("generating...");
const result = await generateText({
  model: modelImage,
  messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
});
const file = result.files?.find((f) => f.mediaType?.startsWith("image/"));
if (!file) {
  console.error("no image in response", {
    files: result.files?.length,
    text: String(result.text || "").slice(0, 200),
  });
  process.exit(1);
}
const bytes = file.uint8Array;
const mediaType = file.mediaType;
const ext = mediaType.includes("jpeg") ? "jpg" : "png";
const path = `${row.user_id}/${reportId}/watch.${ext}`;
const { error: upErr } = await admin.storage
  .from("assets")
  .upload(path, bytes, { contentType: mediaType, upsert: true });
if (upErr) {
  console.error("upload", upErr.message);
  process.exit(1);
}
const { error: updErr } = await admin
  .from("reports")
  .update({ watch_image: path })
  .eq("id", reportId);
if (updErr) {
  console.error("update", updErr.message);
  process.exit(1);
}
console.log("OK", path, bytes.length);
