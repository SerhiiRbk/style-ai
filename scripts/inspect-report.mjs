import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const envFile = process.env.ENV_FILE || "../.env.local";
const env = loadEnv(new URL(envFile, import.meta.url).pathname);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const reportId = process.argv[2];

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: r, error } = await sb
  .from("reports")
  .select(
    "id, created_at, status, tier, user_id, cover_image, capsule_images, hair, facial_hair, eyewear, accessories, headline",
  )
  .eq("id", reportId)
  .single();

if (error) {
  console.error("report error:", error.message);
  process.exit(1);
}

const { data: looks } = await sb
  .from("looks")
  .select("id, image_path, created_at")
  .eq("report_id", reportId)
  .order("created_at", { ascending: true });

const hair = r.hair ?? { recommend: [], avoid: [] };
const hairAll = [...(hair.recommend ?? []), ...(hair.avoid ?? [])];

const summary = {
  status: r.status,
  tier: r.tier,
  headline: r.headline,
  created_at: r.created_at,
  age_minutes: Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000),
  cover_image: r.cover_image ? "yes" : "MISSING",
  looks: {
    total: looks?.length ?? 0,
    withImage: (looks ?? []).filter((l) => l.image_path).length,
  },
  hair: {
    total: hairAll.length,
    withImage: hairAll.filter((h) => h.imagePath).length,
  },
  facial_hair: {
    total: (r.facial_hair ?? []).length,
    withImage: (r.facial_hair ?? []).filter((f) => f.imagePath).length,
  },
  eyewear: {
    total: (r.eyewear ?? []).length,
    withImage: (r.eyewear ?? []).filter((e) => e.imagePath).length,
  },
  accessories: {
    total: (r.accessories ?? []).length,
    withImage: (r.accessories ?? []).filter((a) => a.imagePath).length,
  },
  capsule_images: {
    slots: (r.capsule_images ?? []).length,
    withImage: (r.capsule_images ?? []).filter(Boolean).length,
  },
};

console.log(JSON.stringify(summary, null, 2));
