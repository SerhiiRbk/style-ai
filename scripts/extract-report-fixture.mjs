// Snapshot a production report as an anonymised regression fixture.
//   node scripts/extract-report-fixture.mjs <reportId> <slug>
// Writes src/lib/fixtures/reports/<slug>.json with the profile (no photo hexes,
// no city), palette, shopping, per-look items and structured looks — enough to
// replay capsuleMatrix, the colour gates and the recipes in
// src/lib/report-regression.test.ts. Nothing that identifies the client:
// no user id, no photo paths, no images, no deeplinks.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
function loadEnv(p){const o={};for(const raw of readFileSync(p,"utf8").split("\n")){const l=raw.trim();if(!l||l.startsWith("#"))continue;const i=l.indexOf("=");if(i===-1)continue;let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);o[l.slice(0,i).trim()]=v;}return o;}
const [reportId, slug] = process.argv.slice(2);
if (!reportId || !slug) { console.error("usage: extract-report-fixture.mjs <reportId> <slug>"); process.exit(1); }
const e = loadEnv(".env.local"); const key = e.SUPABASE_SERVICE_ROLE_KEY;
const url = e.NEXT_PUBLIC_SUPABASE_URL || `https://${JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).ref}.supabase.co`;
const sb = createClient(url, key, { auth: { persistSession: false } });
const { data: rep, error } = await sb.from("reports").select("profile, colors, shopping, look_items, tier, created_at").eq("id", reportId).single();
if (error) throw new Error(error.message);
const { data: looks } = await sb.from("looks").select("idx, context, title, description, items").eq("report_id", reportId).order("idx", { ascending: true });
const item = (i) => ({
  category: i.category, title: i.title, color: i.color,
  ...(i.colorName ? { colorName: i.colorName } : {}),
  priceEur: i.priceEur, retailer: i.retailer ?? "",
  ...(i.garment ? { garment: i.garment } : {}),
  ...(i.similarPick ? { similarPick: true } : {}),
});
const p = rep.profile;
const physical = { ...p.physical };
for (const k of ["skinHex", "hairHex", "eyeHex", "measured", "hexesCorrected"]) delete physical[k];
const fixture = {
  slug, tier: rep.tier, createdAt: rep.created_at,
  profile: { ...p, demographics: { ...p.demographics, city: "" }, physical },
  colors: { best: rep.colors.best.map(c => ({ name: c.name, hex: c.hex, ...(c.role ? { role: c.role } : {}) })), avoid: rep.colors.avoid.map(c => ({ name: c.name, hex: c.hex })) },
  shopping: (rep.shopping ?? []).map(item),
  lookItems: Object.fromEntries(Object.entries(rep.look_items ?? {}).map(([k, v]) => [k, v.map(item)])),
  looks: (looks ?? []).map(l => ({ idx: l.idx, context: l.context, title: l.title, description: l.description, items: l.items ?? null })),
};
const out = `src/lib/fixtures/reports/${slug}.json`;
writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
console.log(`${out}: ${fixture.shopping.length} shopping, ${Object.keys(fixture.lookItems).length} looks with items, ${fixture.looks.length} looks`);
